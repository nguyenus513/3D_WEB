/**
 * Fuses mobilenet_backbone.onnx + accessory_head into a single
 * accessory_classifier.onnx (< 10 MB).
 *
 * Strategy: proto3 repeated fields can be extended by appending bytes.
 * We take the backbone's raw GraphProto bytes and append:
 *   - Gemm + Sigmoid nodes (connecting to backbone output "output")
 *   - W[4,1000] + b[4] initializers
 *   - A second output ValueInfo "accessory_output" [1,4]
 *
 * The final model has two graph outputs:
 *   "output"           [1,1000]  — backbone ImageNet logits (intermediate)
 *   "accessory_output" [1,4]     — sigmoid accessory probabilities (used by worker)
 *
 * Uses the same validated protobuf encoding as generate_accessory_model.js.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Protobuf helpers (same encoding as generate_accessory_model.js) ──────────

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

function attrInt(name, value)   { return [...fstr(1, name), ...fv(20, 2), ...fv(3, value)]; }
function attrFloat(name, value) { return [...fstr(1, name), ...fv(20, 1), ...ff32(4, value)]; }

function onnxNode(opType, inputs, outputs, attrs) {
    return [
        ...inputs.flatMap(i  => fstr(1, i)),
        ...outputs.flatMap(o => fstr(2, o)),
        ...fstr(4, opType),
        ...attrs.flatMap(a => fb(5, a)),
    ];
}

function initFloat(name, dims, data) {
    const raw = Buffer.alloc(data.length * 4);
    data.forEach((v, i) => raw.writeFloatLE(v, i * 4));
    return [
        ...packedI64(1, dims),
        ...fv(2, 1),
        ...fstr(8, name),
        ...fb(9, [...raw]),
    ];
}

function tensorShape(dims) { return dims.flatMap(d => fb(1, fv(1, d))); }
function typeFloat(dims) {
    const inner = [...fv(1, 1), ...fb(2, tensorShape(dims))];
    return fb(1, inner);
}
function valueInfo(name, dims) { return [...fstr(1, name), ...typeFloat(dims)]; }

// ─── Minimal protobuf parser (extract raw payload of len-delimited fields) ────

function extractAllLenFields(buf, targetFieldNum) {
    const results = [];
    let i = 0;
    while (i < buf.length) {
        // Read tag varint
        let tagVal = 0, shift = 0;
        while (i < buf.length) {
            const b = buf[i++];
            tagVal |= (b & 0x7f) << shift;
            shift += 7;
            if ((b & 0x80) === 0) break;
        }
        const field = tagVal >>> 3;
        const wire  = tagVal & 7;

        if (wire === 0) { // varint — skip
            while (i < buf.length && (buf[i++] & 0x80) !== 0) {}
        } else if (wire === 2) { // len-delimited
            let len = 0, lshift = 0;
            while (i < buf.length) {
                const b = buf[i++];
                len |= (b & 0x7f) << lshift;
                lshift += 7;
                if ((b & 0x80) === 0) break;
            }
            if (field === targetFieldNum) {
                results.push(buf.slice(i, i + len));
            }
            i += len;
        } else if (wire === 5) { // fixed32
            i += 4;
        } else if (wire === 1) { // fixed64
            i += 8;
        } else {
            break;
        }
    }
    return results;
}

// ─── Load backbone ─────────────────────────────────────────────────────────────

const backboneFile = path.join(__dirname, '..', 'public', 'models', 'mobilenet_backbone.onnx');
const backbone = fs.readFileSync(backboneFile);

console.log('Backbone size:', backbone.length, 'bytes');

// Extract from ModelProto
const backboneGraphBytes    = extractAllLenFields(backbone, 7)[0]; // GraphProto
const backboneOpsetPayloads = extractAllLenFields(backbone, 8);    // opset_import entries

if (!backboneGraphBytes) throw new Error('Could not find GraphProto in backbone model');
console.log('GraphProto size:', backboneGraphBytes.length, 'bytes');
console.log('Opset entries found:', backboneOpsetPayloads.length);

// ─── Build head: Gemm + Sigmoid connecting to backbone's "output" ─────────────

const NUM_CLASSES = 1000;
const NUM_OUTPUTS = 4;
const W = new Float32Array(NUM_OUTPUTS * NUM_CLASSES);

// Row 0: glasses (ImageNet ~836=sunglass, ~837=related)
W[0 * NUM_CLASSES + 836] = 3.0;
W[0 * NUM_CLASSES + 837] = 2.0;
// Row 1: hat (ImageNet ~515=cowboy hat, ~907=sombrero/sunhat)
W[1 * NUM_CLASSES + 515] = 3.0;
W[1 * NUM_CLASSES + 907] = 2.0;
// Row 2: glasses style proxy
W[2 * NUM_CLASSES + 836] = 1.0;
// Row 3: hat style proxy
W[3 * NUM_CLASSES + 515] = 0.5;
W[3 * NUM_CLASSES + 907] = 0.5;

const b = [-3.0, -3.0, 0.0, 0.0];

const W_init = initFloat('W', [NUM_OUTPUTS, NUM_CLASSES], Array.from(W));
const b_init = initFloat('b', [NUM_OUTPUTS],              b);

// Head nodes connect to backbone output tensor ("output")
const headGemm = onnxNode('Gemm', ['output', 'W', 'b'], ['gemm_out'],
    [attrInt('transB', 1), attrFloat('alpha', 1.0), attrFloat('beta', 1.0)]);
const headSigmoid = onnxNode('Sigmoid', ['gemm_out'], ['accessory_output'], []);

// ─── Fuse: append head content to backbone GraphProto bytes ───────────────────
//
// proto3 repeated fields merge on concatenation.
// Field 1  (node)        — adds Gemm + Sigmoid after all backbone nodes
// Field 5  (initializer) — adds W + b after all backbone initializers
// Field 12 (output)      — adds "accessory_output" alongside backbone's "output"

const fusedGraphBytes = Buffer.concat([
    backboneGraphBytes,                                                  // all backbone fields
    Buffer.from(fb(12, valueInfo('accessory_output', [1, NUM_OUTPUTS]))),// new output
    Buffer.from(fb(1,  headGemm)),                                       // Gemm node
    Buffer.from(fb(1,  headSigmoid)),                                    // Sigmoid node
    Buffer.from(fb(5,  W_init)),                                         // W initializer
    Buffer.from(fb(5,  b_init)),                                         // b initializer
]);

console.log('Fused graph size:', fusedGraphBytes.length, 'bytes');

// ─── Build combined ModelProto ─────────────────────────────────────────────────

const modelParts = [
    ...fv(1, 8),   // ir_version = 8 (same as backbone)
    // Preserve ALL backbone opset_import entries (includes quantization domains)
    ...backboneOpsetPayloads.flatMap(p => fb(8, [...p])),
    ...fb(7, [...fusedGraphBytes]),  // combined graph
];

const outPath = path.join(__dirname, '..', 'public', 'models', 'accessory_classifier.onnx');
fs.writeFileSync(outPath, Buffer.from(modelParts));

const outSize = fs.statSync(outPath).size;
console.log(`\naccessory_classifier.onnx written: ${outSize} bytes (${(outSize / 1024 / 1024).toFixed(2)} MB)`);
console.log('Model outputs:');
console.log('  "output"           [1,1000] — MobileNetV2 ImageNet logits');
console.log('  "accessory_output" [1,4]    — sigmoid accessory probs (worker reads this)');
console.log('Head weights: glasses→class[836,837], hat→class[515,907], threshold 0.50');
