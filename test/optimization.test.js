import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { scoreCandidates } from '../src/optimization/scoring.js';

const featureRow = {
  rows: 6,
  cols: 6,
  clues: 8,
  walls: 5,
  solver_nodes_visited: 1000,
  average_branching_factor: 2,
  wall_density: 0.1,
  overall_symmetry: 0.5,
};

test('bootstrap scorer scores candidate batches without a model artifact', () => {
  const scores = scoreCandidates([featureRow], { scorer: 'bootstrap' });

  assert.equal(scores.length, 1);
  assert.equal(scores[0].scorer_name, 'bootstrap_exploration_v0');
  assert.equal(scores[0].predicted_quality_score, '');
  assert.equal(typeof scores[0].ranking_score, 'number');
});

test('auto scorer falls back to bootstrap when model metadata is missing', () => {
  const scores = scoreCandidates([featureRow], {
    scorer: 'auto',
    modelMetadataPath: 'models/does-not-exist.json',
  });

  assert.equal(scores.length, 1);
  assert.equal(scores[0].scorer_name, 'bootstrap_exploration_v0');
});

test('auto scorer falls back to bootstrap when model target is constant', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-model-'));
  const metadataPath = path.join(dir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify({
    constant_target_warning: true,
    model_path: 'missing.ubj',
    feature_columns: [],
  }));

  const scores = scoreCandidates([featureRow], {
    scorer: 'auto',
    modelMetadataPath: metadataPath,
  });

  assert.equal(scores.length, 1);
  assert.equal(scores[0].scorer_name, 'bootstrap_exploration_v0');
});

test('explicit xgboost scorer fails when model metadata is missing', () => {
  assert.throws(() => scoreCandidates([featureRow], {
    scorer: 'xgboost',
    modelMetadataPath: 'models/does-not-exist.json',
  }), /Model metadata not found/);
});
