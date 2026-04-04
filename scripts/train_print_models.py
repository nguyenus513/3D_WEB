"""
3D Printing AI Model Training Script
=====================================

NOTE: This Replit environment does not include a Python runtime.
The equivalent model training is implemented in Node.js at:

    scripts/generate_print_models.js

Run with:

    node scripts/generate_print_models.js

That script produces the same 5 XGBoost-compatible JSON model files
in public/models/ as this script would, using a custom gradient-boosting
implementation with identical feature engineering and output schema.

──────────────────────────────────────────────────────────────────────────────
Python implementation (reference — requires Python 3.10+ with xgboost, numpy)
──────────────────────────────────────────────────────────────────────────────
"""

# To run in a Python-capable environment:
#
#   pip install xgboost numpy
#   python scripts/train_print_models.py
#
# The script below mirrors the Node.js trainer exactly:
#   - 800 synthetic samples (seeded RNG for reproducibility)
#   - 13 mesh/print-setting features
#   - 2 regressors: quote_xgb.json, time_xgb.json
#   - 3 OvR binary classifiers: risk_xgb_0.json, risk_xgb_1.json, risk_xgb_2.json
#     (risk classes: 0=low, 1=medium, 2=high)
#
# Model JSON schema (consistent with xgbRunner.ts):
#   { "type": ..., "feature_names": [...], "baseScore": ..., "learningRate": ..., "trees": [...] }

import json
import os
import random
import math

RANDOM_SEED = 42
random.seed(RANDOM_SEED)

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'models')
os.makedirs(OUT_DIR, exist_ok=True)

FEATURE_NAMES = [
    'volume_cm3', 'bbox_x', 'bbox_y', 'bbox_z',
    'surface_area', 'triangle_count', 'fill_ratio', 'slenderness',
    'support_proxy', 'thin_part_proxy', 'material_fdm', 'infill_pct', 'layer_height',
]


def rand_range(lo, hi):
    return lo + random.random() * (hi - lo)


def rand_int(lo, hi):
    return random.randint(lo, hi)


def rand_choice(items):
    return random.choice(items)


def generate_sample():
    is_fdm = random.random() > 0.35
    bbox_x = rand_range(10, 200)
    bbox_y = rand_range(10, 180)
    bbox_z = rand_range(5, 250)
    bbox_vol = bbox_x * bbox_y * bbox_z
    fill_ratio = rand_range(0.03, 0.75)
    volume_mm3 = bbox_vol * fill_ratio
    volume_cm3 = volume_mm3 / 1000
    surface_area = max(volume_mm3, 0.001) ** (2 / 3) * rand_range(4, 12) / 100
    triangle_count = rand_int(100, 100000)
    max_dim = max(bbox_x, bbox_y, bbox_z)
    min_dim = max(min(bbox_x, bbox_y, bbox_z), 0.1)
    slenderness = max_dim / min_dim
    footprint = max(bbox_x, bbox_y)
    support_proxy = 1 if footprint > 0 and bbox_z / footprint > 2.5 else 0
    thin_part_proxy = min(surface_area / (volume_cm3 * 10), 1) if volume_cm3 > 0 else 0
    infill_pct = rand_choice([0.15, 0.20, 0.30, 0.50]) if is_fdm else 1.0
    layer_height = rand_choice([0.08, 0.12, 0.20]) if is_fdm else 0.05

    density = 1.24 if is_fdm else 1.1
    shell_factor = 1.2
    resin_factor = 1.25
    print_speed = 12 if is_fdm else 6
    layer_mult = {0.08: 4, 0.12: 2, 0.20: 1}.get(layer_height, 1) if is_fdm else 1

    grams = (volume_cm3 * (shell_factor + infill_pct) * density
             if is_fdm else volume_cm3 * resin_factor * density)
    hours = grams / print_speed * layer_mult
    price_base = (600 * grams + 3000 * hours) if is_fdm else (3000 * hours + 3000 * grams)
    price = price_base * (1 + (random.random() - 0.5) * 0.30)
    hours_out = hours * (1 + (random.random() - 0.5) * 0.20)

    risk_score = 0
    if slenderness > 5:
        risk_score += 1.5
    elif slenderness > 3:
        risk_score += 0.8
    if support_proxy:
        risk_score += 1.2
    if thin_part_proxy > 0.5:
        risk_score += 1.0
    if bbox_z > 150:
        risk_score += 0.7
    if fill_ratio < 0.05:
        risk_score += 0.8
    risk_score += (random.random() - 0.5) * 0.8
    risk = 0 if risk_score < 1.0 else (1 if risk_score < 2.2 else 2)

    return {
        'features': {
            'volume_cm3': volume_cm3, 'bbox_x': bbox_x, 'bbox_y': bbox_y, 'bbox_z': bbox_z,
            'surface_area': surface_area, 'triangle_count': triangle_count,
            'fill_ratio': fill_ratio, 'slenderness': slenderness,
            'support_proxy': support_proxy, 'thin_part_proxy': thin_part_proxy,
            'material_fdm': 1 if is_fdm else 0, 'infill_pct': infill_pct,
            'layer_height': layer_height,
        },
        'price': max(1000, price),
        'hours': max(0.1, hours_out),
        'risk': risk,
    }


def mean(arr):
    return sum(arr) / len(arr) if arr else 0


def variance(arr):
    if not arr:
        return 0
    m = mean(arr)
    return sum((v - m) ** 2 for v in arr) / len(arr)


MAX_SPLITS = 15


def get_quantiles(values):
    sorted_vals = sorted(set(values))
    step = max(1, len(sorted_vals) // MAX_SPLITS)
    candidates = set()
    for i in range(step, len(sorted_vals), step):
        candidates.add((sorted_vals[i - 1] + sorted_vals[i]) / 2)
    return list(candidates)


def best_split(X, residuals, feature_names):
    best_gain = -float('inf')
    best_feature = None
    best_threshold = None
    n = len(X)
    base_var = variance(residuals) * n

    for fi in feature_names:
        values = [x[fi] for x in X]
        thresholds = get_quantiles(values)
        for threshold in thresholds:
            left_mask = [v < threshold for v in values]
            left_r = [r for r, m in zip(residuals, left_mask) if m]
            right_r = [r for r, m in zip(residuals, left_mask) if not m]
            if not left_r or not right_r:
                continue
            gain = base_var - variance(left_r) * len(left_r) - variance(right_r) * len(right_r)
            if gain > best_gain:
                best_gain = gain
                best_feature = fi
                best_threshold = threshold

    return best_feature, best_threshold, best_gain


node_id_counter = [0]


def build_tree(X, residuals, depth, max_depth, min_samples, feature_names):
    nid = node_id_counter[0]
    node_id_counter[0] += 1

    if depth >= max_depth or len(X) < min_samples:
        return {'nodeid': nid, 'leaf': mean(residuals)}

    feature, threshold, gain = best_split(X, residuals, feature_names)
    if not feature or gain <= 0:
        return {'nodeid': nid, 'leaf': mean(residuals)}

    left_mask = [x[feature] < threshold for x in X]
    left_X = [x for x, m in zip(X, left_mask) if m]
    left_r = [r for r, m in zip(residuals, left_mask) if m]
    right_X = [x for x, m in zip(X, left_mask) if not m]
    right_r = [r for r, m in zip(residuals, left_mask) if not m]

    left_child = build_tree(left_X, left_r, depth + 1, max_depth, min_samples, feature_names)
    right_child = build_tree(right_X, right_r, depth + 1, max_depth, min_samples, feature_names)

    return {
        'nodeid': nid, 'depth': depth, 'split': feature,
        'split_condition': threshold,
        'yes': left_child['nodeid'], 'no': right_child['nodeid'],
        'missing': left_child['nodeid'],
        'children': [left_child, right_child],
    }


def eval_tree(node, features):
    if 'leaf' in node:
        return node['leaf']
    val = features.get(node['split'], 0)
    next_id = node['yes'] if val < node['split_condition'] else node['no']
    child = next((c for c in node['children'] if c['nodeid'] == next_id), None)
    return eval_tree(child, features) if child else 0


def train_gbm(X, y, n_estimators, max_depth, learning_rate, min_samples):
    base_score = mean(y)
    preds = [base_score] * len(X)
    trees = []
    n = len(X)

    for _ in range(n_estimators):
        residuals = [yi - pi for yi, pi in zip(y, preds)]
        bag_size = round(n * 0.75)
        bag_idx = [random.randint(0, n - 1) for _ in range(bag_size)]
        bag_X = [X[i] for i in bag_idx]
        bag_r = [residuals[i] for i in bag_idx]

        n_feat = max(3, round(len(FEATURE_NAMES) * 0.7))
        feat_sample = random.sample(FEATURE_NAMES, n_feat)

        node_id_counter[0] = 0
        tree = build_tree(bag_X, bag_r, 0, max_depth, min_samples, feat_sample)
        trees.append(tree)

        for j in range(n):
            preds[j] += learning_rate * eval_tree(tree, X[j])

    return trees, base_score


print(f'Generating 800 training samples...')
N = 800
samples = [generate_sample() for _ in range(N)]
X = [s['features'] for s in samples]
GBM_OPTS = dict(n_estimators=50, max_depth=4, learning_rate=0.1, min_samples=4)

print('Training quote regressor...')
trees, base_score = train_gbm(X, [s['price'] for s in samples], **GBM_OPTS)
with open(os.path.join(OUT_DIR, 'quote_xgb.json'), 'w') as f:
    json.dump({'type': 'xgb_regressor', 'feature_names': FEATURE_NAMES,
               'baseScore': base_score, 'learningRate': 0.1, 'trees': trees}, f)
print('Saved quote_xgb.json')

print('Training time regressor...')
trees, base_score = train_gbm(X, [s['hours'] for s in samples], **GBM_OPTS)
with open(os.path.join(OUT_DIR, 'time_xgb.json'), 'w') as f:
    json.dump({'type': 'xgb_regressor', 'feature_names': FEATURE_NAMES,
               'baseScore': base_score, 'learningRate': 0.1, 'trees': trees}, f)
print('Saved time_xgb.json')

RISK_NAMES = ['low', 'medium', 'high']
RISK_OPTS = dict(n_estimators=40, max_depth=3, learning_rate=0.1, min_samples=5)
for cls in range(3):
    print(f'Training risk classifier ({RISK_NAMES[cls]})...')
    y_bin = [1 if s['risk'] == cls else 0 for s in samples]
    trees, base_score = train_gbm(X, y_bin, **RISK_OPTS)
    with open(os.path.join(OUT_DIR, f'risk_xgb_{cls}.json'), 'w') as f:
        json.dump({'type': 'xgb_classifier', 'feature_names': FEATURE_NAMES,
                   'baseScore': base_score, 'learningRate': 0.1, 'trees': trees}, f)
    print(f'Saved risk_xgb_{cls}.json')

print('\nDone! Model files written to public/models/')
print('Risk model format: 3 OvR classifiers (risk_xgb_0=low, risk_xgb_1=medium, risk_xgb_2=high)')
print('Run with: python scripts/train_print_models.py')
