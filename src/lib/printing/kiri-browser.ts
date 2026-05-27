type PrintMode = 'fdm' | 'resin';

interface KiriAnalyzeOptions {
    printType: PrintMode;
    infill: string;
    layerHeight: string;
    support?: boolean;
}

export interface KiriBrowserResult {
    source: 'kiri_moto_browser';
    mode: PrintMode;
    printTimeMinutes: number;
    totalMaterialG: number;
    totalResinMl: number;
    layerHeight: number;
    infill: number;
    support: boolean;
    gcodeBytes: number;
    gcodePreview: string;
    warnings: string[];
}

declare global {
    interface Window {
        Engine?: new (options?: Record<string, unknown>) => any;
        __miniverKiriEnginePromise?: Promise<void>;
    }
}

const KIRI_ENGINE_URL = 'https://grid.space/code/engine.js';

function loadKiriEngine(timeoutMs = 30_000): Promise<void> {
    if (typeof window === 'undefined') return Promise.reject(new Error('Kiri requires browser'));
    if (window.Engine) return Promise.resolve();
    if (window.__miniverKiriEnginePromise) return window.__miniverKiriEnginePromise;

    window.__miniverKiriEnginePromise = new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${KIRI_ENGINE_URL}"]`);
        const script = existing || document.createElement('script');
        const timer = window.setTimeout(() => reject(new Error('Kiri engine load timeout')), timeoutMs);

        script.onload = () => {
            window.clearTimeout(timer);
            if (window.Engine) resolve();
            else reject(new Error('Kiri Engine global not found'));
        };
        script.onerror = () => {
            window.clearTimeout(timer);
            reject(new Error('Kiri engine load failed'));
        };

        if (!existing) {
            script.src = KIRI_ENGINE_URL;
            script.async = true;
            document.head.appendChild(script);
        }
    });

    return window.__miniverKiriEnginePromise;
}

function parseTimeToMinutes(value: string) {
    let minutes = 0;
    const hours = value.match(/(\d+(?:\.\d+)?)\s*h/i);
    const mins = value.match(/(\d+(?:\.\d+)?)\s*m/i);
    const secs = value.match(/(\d+(?:\.\d+)?)\s*s/i);
    if (hours) minutes += Number(hours[1]) * 60;
    if (mins) minutes += Number(mins[1]);
    if (secs) minutes += Number(secs[1]) / 60;
    return Math.round(minutes * 10) / 10;
}

function parseGcodeStats(gcode: string) {
    const filamentG =
        gcode.match(/;\s*filament used \[g\]\s*=\s*([\d.]+)/i)?.[1]
        || gcode.match(/;\s*total filament used \[g\]\s*=\s*([\d.]+)/i)?.[1]
        || gcode.match(/;\s*filament used\s*=\s*([\d.]+)\s*g/i)?.[1];
    const resinMl = gcode.match(/;\s*(?:resin|material) used \[?ml\]?\s*=\s*([\d.]+)/i)?.[1];
    const timeText =
        gcode.match(/;\s*estimated printing time \([^)]*\)\s*=\s*([^\n]+)/i)?.[1]
        || gcode.match(/;\s*print time\s*=\s*([^\n]+)/i)?.[1]
        || '';
    const layerCount = (gcode.match(/;LAYER_CHANGE/g) || []).length;

    return {
        filamentG: Number(filamentG || 0),
        resinMl: Number(resinMl || 0),
        printTimeMinutes: timeText ? parseTimeToMinutes(timeText) : 0,
        layerCount,
    };
}

function buildDevice() {
    return {
        deviceName: 'Miniver Browser Estimate',
        bedWidth: 256,
        bedDepth: 256,
        bedHeight: 256,
        maxHeight: 256,
        nozzleSize: 0.4,
        filamentSize: 1.75,
        gcodePre: ['G21 ; set units to millimeters', 'G90 ; absolute positioning'],
        gcodePost: ['M84 ; disable motors'],
    };
}

function buildProcess(options: KiriAnalyzeOptions) {
    const infill = Number(String(options.infill).replace('%', '')) || 20;
    const layerHeight = Number(options.layerHeight) || 0.2;
    return {
        processName: 'Miniver Browser Slice',
        sliceHeight: layerHeight,
        firstSliceHeight: layerHeight,
        sliceShells: 3,
        sliceFillType: 'hex',
        sliceFillSparse: infill / 100,
        sliceSupportEnable: Boolean(options.support ?? true),
        sliceSupportDensity: 0.2,
        outputTemp: 230,
        outputBedTemp: 70,
        outputFeedrate: 50,
    };
}

export async function analyzeWithKiriMoto(file: File, options: KiriAnalyzeOptions): Promise<KiriBrowserResult> {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!['stl', 'obj', '3mf'].includes(ext)) {
        throw new Error('Kiri only supports STL/OBJ/3MF in this flow');
    }

    await loadKiriEngine();
    const EngineCtor = window.Engine;
    if (!EngineCtor) throw new Error('Kiri Engine unavailable');

    const messages: string[] = [];
    const engine = new EngineCtor()
        .setRender(false)
        .setListener((message: unknown) => {
            if (message && typeof message === 'object') messages.push(JSON.stringify(message).slice(0, 300));
        })
        .setMode(options.printType === 'resin' ? 'SLA' : 'FDM')
        .setDevice(buildDevice())
        .setProcess(buildProcess(options));

    const buffer = await file.arrayBuffer();
    await engine.parse(buffer);
    const gcode = await engine.slice().then((e: any) => e.prepare()).then((e: any) => e.export());
    const text = typeof gcode === 'string' ? gcode : String(gcode || '');
    if (!text || text.length < 20) throw new Error('Kiri exported empty G-code');

    const stats = parseGcodeStats(text);
    return {
        source: 'kiri_moto_browser',
        mode: options.printType,
        printTimeMinutes: stats.printTimeMinutes,
        totalMaterialG: stats.filamentG,
        totalResinMl: stats.resinMl,
        layerHeight: Number(options.layerHeight) || 0.2,
        infill: Number(String(options.infill).replace('%', '')) || 20,
        support: Boolean(options.support ?? true),
        gcodeBytes: text.length,
        gcodePreview: text.slice(0, 1200),
        warnings: messages.filter((msg) => /error|warn|invalid|support|slice/i.test(msg)).slice(0, 8),
    };
}
