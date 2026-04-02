/**
 * Lightweight XGBoost JSON inference engine.
 * Runs entirely in a Web Worker context — no DOM APIs used.
 *
 * Model JSON schema (matches generate_print_models.js output):
 *   { type, feature_names, baseScore, learningRate, trees: [...] }
 *
 * Also accepts snake_case aliases (base_score / learning_rate) for
 * compatibility with models exported directly from the XGBoost library.
 */

interface XGBNode {
    nodeid: number;
    depth?: number;
    split?: string;
    split_condition?: number;
    yes?: number;
    no?: number;
    missing?: number;
    leaf?: number;
    children?: XGBNode[];
}

interface XGBModelRaw {
    type: 'xgb_regressor' | 'xgb_classifier';
    feature_names: string[];
    baseScore?: number;
    learningRate?: number;
    base_score?: number;
    learning_rate?: number;
    trees: XGBNode[];
}

interface XGBModel {
    type: 'xgb_regressor' | 'xgb_classifier';
    feature_names: string[];
    baseScore: number;
    learningRate: number;
    trees: XGBNode[];
}

function normalizeModel(raw: XGBModelRaw): XGBModel {
    const baseScore = raw.baseScore ?? raw.base_score ?? 0;
    const learningRate = raw.learningRate ?? raw.learning_rate ?? 0.1;
    return { ...raw, baseScore, learningRate };
}

function traverseNode(node: XGBNode, features: Record<string, number>): number {
    if (node.leaf !== undefined) {
        return node.leaf;
    }

    const featureName = node.split!;
    const featureVal = features[featureName] ?? 0;
    const threshold = node.split_condition!;

    const goLeft = featureVal < threshold;
    const nextId = goLeft ? node.yes! : node.no!;

    if (!node.children) return 0;
    const nextNode = node.children.find(c => c.nodeid === nextId);
    if (!nextNode) return 0;
    return traverseNode(nextNode, features);
}

function predictRaw(model: XGBModel, features: Record<string, number>): number {
    let sum = model.baseScore;
    for (const tree of model.trees) {
        sum += model.learningRate * traverseNode(tree, features);
    }
    return sum;
}

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

function softmax(values: number[]): number[] {
    const maxVal = Math.max(...values);
    const exps = values.map(v => Math.exp(v - maxVal));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sumExps);
}

export class XGBRunner {
    private model: XGBModel | null = null;
    private modelUrl: string;

    constructor(modelUrl: string) {
        this.modelUrl = modelUrl;
    }

    async load(): Promise<void> {
        const resp = await fetch(this.modelUrl);
        if (!resp.ok) {
            throw new Error(`Failed to load model from ${this.modelUrl}: ${resp.status}`);
        }
        const raw = await resp.json() as XGBModelRaw;
        this.model = normalizeModel(raw);
    }

    isLoaded(): boolean {
        return this.model !== null;
    }

    predictRegression(features: Record<string, number>): number {
        if (!this.model) throw new Error('Model not loaded');
        const raw = predictRaw(this.model, features);
        if (!Number.isFinite(raw)) throw new Error(`Non-finite prediction: ${raw}`);
        return Math.max(0, raw);
    }

    predictClassProbabilities(features: Record<string, number>): number[] {
        if (!this.model) throw new Error('Model not loaded');
        const raw = predictRaw(this.model, features);
        if (!Number.isFinite(raw)) throw new Error(`Non-finite class prediction: ${raw}`);
        if (this.model.type === 'xgb_classifier') {
            const prob = sigmoid(raw);
            return [1 - prob, prob];
        }
        return [sigmoid(raw)];
    }

    predictClassLabel(features: Record<string, number>): number {
        const probs = this.predictClassProbabilities(features);
        return probs.indexOf(Math.max(...probs));
    }
}

export class XGBMulticlassRunner {
    private models: XGBModel[] = [];
    private modelUrls: string[];

    constructor(modelUrls: string[]) {
        this.modelUrls = modelUrls;
    }

    async load(): Promise<void> {
        const raws = await Promise.all(
            this.modelUrls.map(async (url) => {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
                return resp.json() as Promise<XGBModelRaw>;
            }),
        );
        this.models = raws.map(normalizeModel);
    }

    isLoaded(): boolean {
        return this.models.length === this.modelUrls.length;
    }

    predictClassIndex(features: Record<string, number>): { classIndex: number; probabilities: number[] } {
        const rawScores = this.models.map(m => {
            const score = predictRaw(m, features);
            if (!Number.isFinite(score)) throw new Error(`Non-finite score in multiclass model: ${score}`);
            return score;
        });
        const probs = softmax(rawScores);
        const classIndex = probs.indexOf(Math.max(...probs));
        return { classIndex, probabilities: probs };
    }
}
