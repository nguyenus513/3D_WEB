/**
 * Generates accessory_head.onnx — the classification head for the accessory classifier.
 *
 * Architecture: Input[1,1000] → Gemm(W[4,1000], b[4], transB=1) → Sigmoid → Output[1,4]
 *
 * The input is the 1000-class logit vector from the MobileNetV2 backbone.
 * Sparse weights target approximate ImageNet ILSVRC-2012 class indices:
 *   - Row 0 (glasses): class 836 "sunglass" and 837
 *   - Row 1 (hat):     class 515 "cowboy hat" and 907 "sombrero/sunhat"
 *   - Row 2 (glasses style proxy): smooth response on class 836
 *   - Row 3 (hat style proxy):     smooth response on classes 515/907
 *
 * Detection threshold 0.50: fires when backbone logit for target class ≥ ~1.0.
 *
 * Uses the same protobuf encoding as generate_accessory_model.js (validated by ORT).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Minimal protobuf encoder (same as generate_accessory_model.js) ───────────

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

const VARINT  = 0;
const LEN     = 2;
const FIXED32 = 5;

function fTag(n, w)  { return encodeVarint(n * 8 + w); }
function fv(n, val)  { return [...fTag(n, VARINT), ...encodeVarint(val)]; }
function fb(n, bytes){ return [...fTag(n, LEN), ...encodeVarint(bytes.length), ...bytes]; }
function fstr(n, s)  { return fb(n, [...Buffer.from(s, 'utf8')]); }
function ff32(n, val){ const b = Buffer.alloc(4); b.writeFloatLE(val); return [...fTag(n, FIXED32), ...b]; }
function packedI64(n, values) { return fb(n, values.flatMap(v => encodeVarint(v))); }

// ─── ONNX node / attribute helpers ───────────────────────────────────────────

function attrInt(name, value) {
    // AttributeProto: name=1, type=20 INT(2), i=3
    return [...fstr(1, name), ...fv(20, 2), ...fv(3, value)];
}

function attrFloat(name, value) {
    // AttributeProto: name=1, type=20 FLOAT(1), f=4 (FIXED32)
    return [...fstr(1, name), ...fv(20, 1), ...ff32(4, value)];
}

function onnxNode(opType, inputs, outputs, attrs) {
    // NodeProto: input=1, output=2, op_type=4, attribute=5
    return [
        ...inputs.flatMap(i  => fstr(1, i)),
        ...outputs.flatMap(o => fstr(2, o)),
        ...fstr(4, opType),
        ...attrs.flatMap(a => fb(5, a)),
    ];
}

// TensorProto: float32 values stored via raw_data (field 9 — validated encoding)
function initFloat(name, dims, data) {
    const raw = Buffer.alloc(data.length * 4);
    data.forEach((v, i) => raw.writeFloatLE(v, i * 4));
    return [
        ...packedI64(1, dims),      // dims = field 1
        ...fv(2, 1),                // data_type = FLOAT(1) = field 2
        ...fstr(8, name),           // name = field 8
        ...fb(9, [...raw]),         // raw_data = field 9
    ];
}

// ValueInfoProto with float32 tensor type
function tensorShape(dims) {
    return dims.flatMap(d => fb(1, fv(1, d)));
}

function typeFloat(dims) {
    // TypeProto.Tensor: elem_type=1, shape
    const inner = [...fv(1, 1), ...fb(2, tensorShape(dims))];
    return fb(1, inner); // TypeProto.tensor_type = field 1
}

function valueInfo(name, dims) {
    return [...fstr(1, name), ...typeFloat(dims)];
}

// GraphProto builder
function buildGraph(nodes, inputs, outputs, initializers) {
    return [
        ...nodes.flatMap(n       => fb(1,  n)),   // node = field 1
        ...inputs.flatMap(i      => fb(11, i)),   // input = field 11
        ...outputs.flatMap(o     => fb(12, o)),   // output = field 12
        ...initializers.flatMap(i => fb(5,  i)),  // initializer = field 5
    ];
}

// ModelProto builder (ir_version=8, opset 13)
function buildModel(graph) {
    const opset = [...fstr(1, ''), ...fv(2, 13)];
    return [
        ...fv(1, 8),            // ir_version = 8
        ...fb(8, opset),        // opset_import = field 8
        ...fb(7, graph),        // graph = field 7
    ];
}

// ─── Weight matrix W[4,1000] — sparse targets for ImageNet accessory classes ─

const NUM_CLASSES = 1000;
const NUM_OUTPUTS = 4;
const W = new Float32Array(NUM_OUTPUTS * NUM_CLASSES); // row-major [4, 1000]

// Row 0: glasses (ImageNet ~836=sunglass, ~837=related)
W[0 * NUM_CLASSES + 836] = 3.0;
W[0 * NUM_CLASSES + 837] = 2.0;

// Row 1: hat (ImageNet ~515=cowboy hat, ~907=sombrero/sunhat)
W[1 * NUM_CLASSES + 515] = 3.0;
W[1 * NUM_CLASSES + 907] = 2.0;

// Row 2: glasses style proxy (continuous signal from sunglass class)
W[2 * NUM_CLASSES + 836] = 1.0;

// Row 3: hat style proxy (combined hat classes)
W[3 * NUM_CLASSES + 515] = 0.5;
W[3 * NUM_CLASSES + 907] = 0.5;

const b = [-3.0, -3.0, 0.0, 0.0]; // bias: rows 0/1 fire at logit ≥ ~1.0

// ─── Build ONNX model ─────────────────────────────────────────────────────────

const W_init = initFloat('W', [NUM_OUTPUTS, NUM_CLASSES], Array.from(W));
const b_init = initFloat('b', [NUM_OUTPUTS],              b);

const nodes = [
    onnxNode('Gemm',    ['input', 'W', 'b'], ['gemm_out'],
        [attrInt('transB', 1), attrFloat('alpha', 1.0), attrFloat('beta', 1.0)]),
    onnxNode('Sigmoid', ['gemm_out'],        ['output'], []),
];

const graph = buildGraph(
    nodes,
    [valueInfo('input',  [1, NUM_CLASSES])],
    [valueInfo('output', [1, NUM_OUTPUTS])],
    [W_init, b_init],
);

const modelBytes = Buffer.from(buildModel(graph));

const outPath = path.join(__dirname, '..', 'public', 'models', 'accessory_head.onnx');
fs.writeFileSync(outPath, modelBytes);

const stats = fs.statSync(outPath);
console.log(`accessory_head.onnx written: ${stats.size} bytes`);
console.log(`Architecture: [1,1000] → Gemm(W[4,1000]) → Sigmoid → [1,4]`);
console.log(`Sparse weights: glasses→[836,837], hat→[515,907], threshold 0.50`);
