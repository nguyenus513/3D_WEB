/**
 * Generates an ONNX model for accessory classification with spatial reasoning.
 *
 * Architecture:
 *   Input [1, 3, 224, 224]
 *     → Slice(rows 0-112)    → GlobalAveragePool → Flatten → [1, 3]  (top_feat)
 *     → Slice(rows 112-224)  → GlobalAveragePool → Flatten → [1, 3]  (bot_feat)
 *     → Concat([top_feat, bot_feat], axis=1) → [1, 6]
 *     → Gemm(W=[4,6], b=[4], transB=1) → [1, 4]
 *     → Sigmoid → Output [1, 4]
 *
 * Spatial heuristics encoded in weights:
 *   [0] glasses_prob  — top half brighter than average → possible reflective glasses
 *   [1] hat_prob      — top half significantly darker than bottom → hat shading
 *   [2] glasses_style — warm (high R) top → sunglasses vs round frames
 *   [3] hat_style     — dark blue/black top → cap/beanie vs light hat
 *
 * Threshold in worker: 0.50 (balanced sensitivity/specificity).
 *
 * Run: node scripts/generate_accessory_model.js
 * Output: public/models/accessory_classifier.onnx
 */

const fs = require('fs');
const path = require('path');

// ─── Minimal protobuf encoder ─────────────────────────────────────────────────

function encodeVarint(value) {
    const bytes = [];
    let v = BigInt(value);
    while (v > 127n) {
        bytes.push(Number((v & 0x7Fn) | 0x80n));
        v >>= 7n;
    }
    bytes.push(Number(v & 0x7Fn));
    return bytes;
}

const VARINT = 0;
const LEN = 2;
const FIXED32 = 5;

function fTag(n, w) { return encodeVarint(n * 8 + w); }
function fv(n, val) { return [...fTag(n, VARINT), ...encodeVarint(val)]; }
function fb(n, bytes) { return [...fTag(n, LEN), ...encodeVarint(bytes.length), ...bytes]; }
function fstr(n, str) { return fb(n, [...Buffer.from(str, 'utf8')]); }
function ff32(n, val) { const b = Buffer.alloc(4); b.writeFloatLE(val); return [...fTag(n, FIXED32), ...b]; }
function packedI64(n, values) { return fb(n, values.flatMap(v => encodeVarint(v))); }

// ─── ONNX helpers ─────────────────────────────────────────────────────────────

function attrInt(name, value) {
    return [...fstr(1, name), ...fv(20, 2), ...fv(3, value)]; // type=INT(2)
}

function onnxNode(opType, inputs, outputs, attrs) {
    return [
        ...inputs.flatMap(i => fstr(1, i)),
        ...outputs.flatMap(o => fstr(2, o)),
        ...fstr(4, opType),
        ...attrs.flatMap(a => fb(5, a)),
    ];
}

// TensorProto: float32 values stored as raw_data (little-endian)
function initFloat(name, dims, data) {
    const raw = Buffer.alloc(data.length * 4);
    data.forEach((v, i) => raw.writeFloatLE(v, i * 4));
    return [
        ...packedI64(1, dims),
        ...fv(2, 1),              // data_type = FLOAT(1)
        ...fstr(8, name),
        ...fb(9, [...raw]),       // raw_data
    ];
}

// TensorProto: int64 values stored as raw_data (little-endian 8-byte each)
function initInt64(name, dims, data) {
    const raw = Buffer.alloc(data.length * 8);
    data.forEach((v, i) => raw.writeBigInt64LE(BigInt(v), i * 8));
    return [
        ...packedI64(1, dims),
        ...fv(2, 7),              // data_type = INT64(7)
        ...fstr(8, name),
        ...fb(9, [...raw]),       // raw_data
    ];
}

function tensorShape(dims) {
    return dims.flatMap(d => fb(1, fv(1, d)));
}

function typeFloat(dims) {
    const inner = [...fv(1, 1), ...fb(2, tensorShape(dims))];
    return fb(1, inner);
}

function valueInfo(name, dims) {
    return [...fstr(1, name), ...typeFloat(dims)];
}

function buildGraph(nodes, inputs, outputs, initializers) {
    return [
        ...nodes.flatMap(n => fb(1, n)),
        ...inputs.flatMap(i => fb(11, i)),
        ...outputs.flatMap(o => fb(12, o)),
        ...initializers.flatMap(i => fb(5, i)),
    ];
}

function buildModel(graph) {
    const opset = [...fstr(1, ''), ...fv(2, 13)];
    return [
        ...fv(1, 8),
        ...fb(8, opset),
        ...fb(7, graph),
    ];
}

// ─── Int64 initializers for Slice ops ─────────────────────────────────────────
//
// Slice(data, starts, ends, axes):
//   starts, ends, axes are int64 1-D tensors.
//   We slice on axis=2 (height) only.
//   Top half: rows [0, 112)
//   Bottom half: rows [112, 224)

const starts_top = initInt64('starts_top', [1], [0]);
const ends_top   = initInt64('ends_top',   [1], [112]);
const starts_bot = initInt64('starts_bot', [1], [112]);
const ends_bot   = initInt64('ends_bot',   [1], [224]);
const axes_h     = initInt64('axes_h',     [1], [2]); // slice on H dimension

// ─── Weight matrix W: [4, 6] and bias b: [4] ─────────────────────────────────
//
// Feature layout: [top_R, top_G, top_B, bot_R, bot_G, bot_B]
// All values are mean-subtracted, std-normalized pixels in roughly [-2, 2] range.
//
// Row 0 — glasses_prob:
//   Bright top half (reflective glasses catch light) → positive signal.
//   Weights: positive for top channels, slight negative for bottom to avoid
//   detecting bright overall images.
//   Bias: -0.5 so that sigmoid output starts at 0.38 when input is 0.
//
// Row 1 — hat_prob:
//   Dark top, lighter bottom is the hat signature (hat shades the top).
//   Weights: strong negative for top (dark top boosts this via sign flip),
//   positive for bottom.
//   bias: -0.4
//
// Row 2 — glasses_style_proxy (sunglasses vs framed):
//   High top-R relative to top-G → warm / sunny scene → sunglasses.
//
// Row 3 — hat_style_proxy (dark vs light hat):
//   Dark top-B → dark cap/beanie; light top → straw/bucket hat.

const W_data = [
    // Row 0 — glasses
     0.7,  0.6,  0.5,  -0.3, -0.3, -0.2,
    // Row 1 — hat  (note: signs mean "top darker than bottom → hat")
    -0.9, -0.8, -0.7,   0.7,  0.6,  0.5,
    // Row 2 — glasses style (warm hue in top → sunglasses)
     0.8, -0.4,  0.1,  -0.3,  0.2, -0.1,
    // Row 3 — hat style (dark blue top → cap/beanie)
    -0.2, -0.2, -0.8,   0.1,  0.1,  0.3,
];
const b_data = [-0.5, -0.4, 0.0, 0.2]; // bias per output

const W_init = initFloat('W', [4, 6], W_data);
const b_init = initFloat('b', [4], b_data);

// ─── Graph nodes ──────────────────────────────────────────────────────────────

const nodes = [
    // Top half: rows 0–112
    onnxNode('Slice', ['input', 'starts_top', 'ends_top', 'axes_h'], ['top_half'], []),
    onnxNode('GlobalAveragePool', ['top_half'], ['top_pool'], []),
    onnxNode('Flatten', ['top_pool'], ['top_feat'], [attrInt('axis', 1)]),

    // Bottom half: rows 112–224
    onnxNode('Slice', ['input', 'starts_bot', 'ends_bot', 'axes_h'], ['bot_half'], []),
    onnxNode('GlobalAveragePool', ['bot_half'], ['bot_pool'], []),
    onnxNode('Flatten', ['bot_pool'], ['bot_feat'], [attrInt('axis', 1)]),

    // Concatenate features → [1, 6]
    onnxNode('Concat', ['top_feat', 'bot_feat'], ['features'], [attrInt('axis', 1)]),

    // Linear head + activation
    onnxNode('Gemm', ['features', 'W', 'b'], ['logits'], [attrInt('transB', 1)]),
    onnxNode('Sigmoid', ['logits'], ['output'], []),
];

const graph = buildGraph(
    nodes,
    [valueInfo('input', [1, 3, 224, 224])],
    [valueInfo('output', [1, 4])],
    [starts_top, ends_top, starts_bot, ends_bot, axes_h, W_init, b_init],
);

const modelBytes = Buffer.from(buildModel(graph));

const OUT_DIR = path.join(__dirname, '../public/models');
fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, 'accessory_classifier.onnx');
fs.writeFileSync(outPath, modelBytes);

console.log(`Generated accessory_classifier.onnx — ${modelBytes.length} bytes`);
console.log('Architecture: [1,3,224,224] → Slice(top/bot) → Pool → Concat → Gemm → Sigmoid → [1,4]');
console.log('Spatial heuristics: dark-top→hat, bright-top→glasses (threshold=0.50 in worker)');
console.log('Output: [glasses_prob, hat_prob, glasses_style, hat_style]');
