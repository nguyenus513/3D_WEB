/**
 * Generates XGBoost-compatible JSON model files for 3D printing AI.
 * Optimized: limits split candidates to max 15 quantiles per feature.
 *
 * Outputs:
 *   public/models/quote_xgb.json
 *   public/models/time_xgb.json
 *   public/models/risk_xgb_0.json  (low)
 *   public/models/risk_xgb_1.json  (medium)
 *   public/models/risk_xgb_2.json  (high)
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../public/models');
fs.mkdirSync(OUT_DIR, { recursive: true });

function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(42);
const randRange = (lo, hi) => lo + rand() * (hi - lo);
const randInt = (lo, hi) => Math.floor(randRange(lo, hi + 1));
const randChoice = arr => arr[Math.floor(rand() * arr.length)];

const FEATURE_NAMES = [
    'volume_cm3', 'bbox_x', 'bbox_y', 'bbox_z',
    'surface_area', 'triangle_count', 'fill_ratio', 'slenderness',
    'support_proxy', 'thin_part_proxy', 'material_fdm', 'infill_pct', 'layer_height',
];

function generateSample() {
    const isFDM = rand() > 0.35;
    const bbox_x = randRange(10, 200);
    const bbox_y = randRange(10, 180);
    const bbox_z = randRange(5, 250);
    const bboxVol = bbox_x * bbox_y * bbox_z;
    const fill_ratio = randRange(0.03, 0.75);
    const volume_mm3 = bboxVol * fill_ratio;
    const volume_cm3 = volume_mm3 / 1000;
    const surface_area = Math.pow(Math.max(volume_mm3, 0.001), 2 / 3) * randRange(4, 12) / 100;
    const triangle_count = randInt(100, 100000);
    const maxDim = Math.max(bbox_x, bbox_y, bbox_z);
    const minDim = Math.max(Math.min(bbox_x, bbox_y, bbox_z), 0.1);
    const slenderness = maxDim / minDim;
    const footprint = Math.max(bbox_x, bbox_y);
    const support_proxy = (footprint > 0 && bbox_z / footprint > 2.5) ? 1 : 0;
    const thin_part_proxy = volume_cm3 > 0 ? Math.min(surface_area / (volume_cm3 * 10), 1) : 0;
    const infill_pct = isFDM ? randChoice([0.15, 0.20, 0.30, 0.50]) : 1.0;
    const layer_height = isFDM ? randChoice([0.08, 0.12, 0.20]) : 0.05;

    const DENSITY = isFDM ? 1.24 : 1.1;
    const SHELL_FACTOR = 1.2;
    const RESIN_FACTOR = 1.25;
    const PRINT_SPEED = isFDM ? 12 : 6;
    const LAYER_MULT = isFDM ? (layer_height <= 0.08 ? 4 : layer_height <= 0.12 ? 2 : 1) : 1;

    const grams = isFDM
        ? volume_cm3 * (SHELL_FACTOR + infill_pct) * DENSITY
        : volume_cm3 * RESIN_FACTOR * DENSITY;

    const hours = (grams / PRINT_SPEED) * LAYER_MULT;
    const priceBase = isFDM ? 600 * grams + 3000 * hours : 3000 * hours + 3000 * grams;
    const price = priceBase * (1 + (rand() - 0.5) * 0.30);
    const hoursOut = hours * (1 + (rand() - 0.5) * 0.20);

    let riskScore = 0;
    if (slenderness > 5) riskScore += 1.5;
    else if (slenderness > 3) riskScore += 0.8;
    if (support_proxy) riskScore += 1.2;
    if (thin_part_proxy > 0.5) riskScore += 1.0;
    if (bbox_z > 150) riskScore += 0.7;
    if (fill_ratio < 0.05) riskScore += 0.8;
    riskScore += (rand() - 0.5) * 0.8;
    const risk = riskScore < 1.0 ? 0 : riskScore < 2.2 ? 1 : 2;

    return {
        features: {
            volume_cm3, bbox_x, bbox_y, bbox_z, surface_area,
            triangle_count, fill_ratio, slenderness, support_proxy, thin_part_proxy,
            material_fdm: isFDM ? 1 : 0, infill_pct, layer_height,
        },
        price: Math.max(1000, price),
        hours: Math.max(0.1, hoursOut),
        risk,
    };
}

function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
    if (!arr.length) return 0;
    const m = mean(arr);
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

const MAX_SPLITS = 15;

function getQuantiles(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const step = Math.max(1, Math.floor(sorted.length / MAX_SPLITS));
    const candidates = new Set();
    for (let i = step; i < sorted.length; i += step) {
        candidates.add((sorted[i - 1] + sorted[i]) / 2);
    }
    return [...candidates];
}

function bestSplitRegression(X, residuals, featureNames) {
    let bestGain = -Infinity;
    let bestFeature = null;
    let bestThreshold = null;
    const n = X.length;
    const baseVar = variance(residuals) * n;

    for (const fi of featureNames) {
        const values = X.map(x => x[fi]);
        const thresholds = getQuantiles(values);

        for (const threshold of thresholds) {
            const leftMask = values.map(v => v < threshold);
            const leftY = residuals.filter((_, i) => leftMask[i]);
            const rightY = residuals.filter((_, i) => !leftMask[i]);
            if (!leftY.length || !rightY.length) continue;

            const gain = baseVar - variance(leftY) * leftY.length - variance(rightY) * rightY.length;
            if (gain > bestGain) {
                bestGain = gain;
                bestFeature = fi;
                bestThreshold = threshold;
            }
        }
    }
    return { feature: bestFeature, threshold: bestThreshold, gain: bestGain };
}

let nodeIdCounter = 0;

function buildTree(X, residuals, depth, maxDepth, minSamples, featureNames) {
    const id = nodeIdCounter++;
    if (depth >= maxDepth || X.length < minSamples) {
        return { nodeid: id, leaf: mean(residuals) };
    }
    const { feature, threshold, gain } = bestSplitRegression(X, residuals, featureNames);
    if (!feature || gain <= 0) {
        return { nodeid: id, leaf: mean(residuals) };
    }
    const leftMask = X.map(x => x[feature] < threshold);
    const leftX = X.filter((_, i) => leftMask[i]);
    const leftR = residuals.filter((_, i) => leftMask[i]);
    const rightX = X.filter((_, i) => !leftMask[i]);
    const rightR = residuals.filter((_, i) => !leftMask[i]);

    const leftChild = buildTree(leftX, leftR, depth + 1, maxDepth, minSamples, featureNames);
    const rightChild = buildTree(rightX, rightR, depth + 1, maxDepth, minSamples, featureNames);

    return {
        nodeid: id,
        depth,
        split: feature,
        split_condition: threshold,
        yes: leftChild.nodeid,
        no: rightChild.nodeid,
        missing: leftChild.nodeid,
        children: [leftChild, rightChild],
    };
}

function evalTree(node, features) {
    if (node.leaf !== undefined) return node.leaf;
    const val = features[node.split] ?? 0;
    const child = node.children.find(c => c.nodeid === (val < node.split_condition ? node.yes : node.no));
    return child ? evalTree(child, features) : 0;
}

function trainGBM(X, y, { nEstimators, maxDepth, learningRate, minSamples }) {
    const baseScore = mean(y);
    const preds = new Array(X.length).fill(baseScore);
    const trees = [];
    const n = X.length;

    for (let i = 0; i < nEstimators; i++) {
        const residuals = y.map((yi, j) => yi - preds[j]);
        const bagSize = Math.round(n * 0.75);
        const bagIdx = Array.from({ length: bagSize }, () => randInt(0, n - 1));
        const bagX = bagIdx.map(j => X[j]);
        const bagR = bagIdx.map(j => residuals[j]);

        const nFeat = Math.max(3, Math.round(FEATURE_NAMES.length * 0.7));
        const featSample = [...FEATURE_NAMES].sort(() => rand() - 0.5).slice(0, nFeat);

        nodeIdCounter = 0;
        const tree = buildTree(bagX, bagR, 0, maxDepth, minSamples, featSample);
        trees.push(tree);

        for (let j = 0; j < n; j++) {
            preds[j] += learningRate * evalTree(tree, X[j]);
        }
    }
    return { trees, baseScore, learningRate };
}

const N = 800;
console.log(`Generating ${N} training samples...`);
const samples = Array.from({ length: N }, generateSample);
const X = samples.map(s => s.features);

const GBM_OPTS = { nEstimators: 50, maxDepth: 4, learningRate: 0.1, minSamples: 4 };

console.log('Training quote regressor...');
const quoteGBM = trainGBM(X, samples.map(s => s.price), GBM_OPTS);
fs.writeFileSync(path.join(OUT_DIR, 'quote_xgb.json'), JSON.stringify({ type: 'xgb_regressor', feature_names: FEATURE_NAMES, ...quoteGBM }));
console.log('Saved quote_xgb.json');

console.log('Training time regressor...');
const timeGBM = trainGBM(X, samples.map(s => s.hours), GBM_OPTS);
fs.writeFileSync(path.join(OUT_DIR, 'time_xgb.json'), JSON.stringify({ type: 'xgb_regressor', feature_names: FEATURE_NAMES, ...timeGBM }));
console.log('Saved time_xgb.json');

const RISK_NAMES = ['low', 'medium', 'high'];
const RISK_OPTS = { nEstimators: 40, maxDepth: 3, learningRate: 0.1, minSamples: 5 };
for (let cls = 0; cls < 3; cls++) {
    console.log(`Training risk classifier (${RISK_NAMES[cls]})...`);
    const yBin = samples.map(s => s.risk === cls ? 1 : 0);
    const riskGBM = trainGBM(X, yBin, RISK_OPTS);
    fs.writeFileSync(path.join(OUT_DIR, `risk_xgb_${cls}.json`), JSON.stringify({ type: 'xgb_classifier', feature_names: FEATURE_NAMES, ...riskGBM }));
    console.log(`Saved risk_xgb_${cls}.json`);
}

console.log('\nEvaluating on 100 samples...');
let priceMAPE = 0, hoursMAPE = 0, riskOK = 0;
const ev = samples.slice(0, 100);
const qModel = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'quote_xgb.json'), 'utf8'));
const tModel = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'time_xgb.json'), 'utf8'));
const rModels = [0, 1, 2].map(c => JSON.parse(fs.readFileSync(path.join(OUT_DIR, `risk_xgb_${c}.json`), 'utf8')));

for (const s of ev) {
    const f = s.features;
    let p = qModel.baseScore;
    for (const t of qModel.trees) p += qModel.learningRate * evalTree(t, f);
    priceMAPE += Math.abs(p - s.price) / s.price;

    let h = tModel.baseScore;
    for (const t of tModel.trees) h += tModel.learningRate * evalTree(t, f);
    hoursMAPE += Math.abs(h - s.hours) / s.hours;

    const rawScores = rModels.map(m => {
        let sc = m.baseScore;
        for (const t of m.trees) sc += m.learningRate * evalTree(t, f);
        return sc;
    });
    if (rawScores.indexOf(Math.max(...rawScores)) === s.risk) riskOK++;
}
console.log(`Price MAPE: ${(priceMAPE / ev.length * 100).toFixed(1)}%`);
console.log(`Hours MAPE: ${(hoursMAPE / ev.length * 100).toFixed(1)}%`);
console.log(`Risk Accuracy: ${(riskOK / ev.length * 100).toFixed(1)}%`);
console.log('\nDone!');
