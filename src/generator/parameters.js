import { createRng } from './random.js';

export const GENERATOR_PARAMETER_COLUMNS = [
  'generator_clue_density',
  'generator_wall_density',
  'generator_turn_bias',
  'generator_symmetry_bias',
  'generator_path_wiggle_factor',
  'generator_clue_spacing_bias',
];

export const DEFAULT_GENERATOR_PARAMETERS = {
  clueDensity: 0.33,
  wallDensity: 0.16,
  turnBias: 0.5,
  symmetryBias: 0.0,
  pathWiggleFactor: 0.5,
  clueSpacingBias: 0.75,
};

const TARGET_PRESETS = {
  easy: {
    clueDensity: 0.42,
    wallDensity: 0.1,
    turnBias: 0.35,
    symmetryBias: 0.1,
    pathWiggleFactor: 0.35,
    clueSpacingBias: 0.85,
  },
  medium: DEFAULT_GENERATOR_PARAMETERS,
  hard: {
    clueDensity: 0.26,
    wallDensity: 0.22,
    turnBias: 0.7,
    symmetryBias: 0.05,
    pathWiggleFactor: 0.75,
    clueSpacingBias: 0.62,
  },
};

/**
 * @typedef {{
 *   clueDensity: number,
 *   wallDensity: number,
 *   turnBias: number,
 *   symmetryBias: number,
 *   pathWiggleFactor: number,
 *   clueSpacingBias: number
 * }} GeneratorParameters
 */

/**
 * @param {'easy' | 'medium' | 'hard'} target
 * @param {Partial<GeneratorParameters>} overrides
 * @returns {GeneratorParameters}
 */
export function normalizeGeneratorParameters(target = 'medium', overrides = {}) {
  const preset = TARGET_PRESETS[target] ?? TARGET_PRESETS.medium;

  return {
    clueDensity: clamp01(overrides.clueDensity ?? preset.clueDensity),
    wallDensity: clamp01(overrides.wallDensity ?? preset.wallDensity),
    turnBias: clamp01(overrides.turnBias ?? preset.turnBias),
    symmetryBias: clamp01(overrides.symmetryBias ?? preset.symmetryBias),
    pathWiggleFactor: clamp01(overrides.pathWiggleFactor ?? preset.pathWiggleFactor),
    clueSpacingBias: clamp01(overrides.clueSpacingBias ?? preset.clueSpacingBias),
  };
}

/**
 * @param {string} seed
 * @returns {GeneratorParameters}
 */
export function sampleGeneratorParameters(seed) {
  const rng = createRng(`generator-parameters:${seed}`);

  return {
    clueDensity: sampleRange(rng, 0.2, 0.52),
    wallDensity: sampleRange(rng, 0, 0.32),
    turnBias: rng(),
    symmetryBias: rng(),
    pathWiggleFactor: rng(),
    clueSpacingBias: sampleRange(rng, 0.35, 1),
  };
}

/**
 * @param {GeneratorParameters} parameters
 */
export function generatorParameterRow(parameters) {
  return {
    generator_clue_density: parameters.clueDensity,
    generator_wall_density: parameters.wallDensity,
    generator_turn_bias: parameters.turnBias,
    generator_symmetry_bias: parameters.symmetryBias,
    generator_path_wiggle_factor: parameters.pathWiggleFactor,
    generator_clue_spacing_bias: parameters.clueSpacingBias,
  };
}

/**
 * @param {GeneratorParameters} parameters
 */
export function parameterSignature(parameters) {
  return [
    parameters.clueDensity,
    parameters.wallDensity,
    parameters.turnBias,
    parameters.symmetryBias,
    parameters.pathWiggleFactor,
    parameters.clueSpacingBias,
  ].map((value) => value.toFixed(3)).join(':');
}

/**
 * @param {number} value
 */
function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * @param {() => number} rng
 * @param {number} min
 * @param {number} max
 */
function sampleRange(rng, min, max) {
  return min + (max - min) * rng();
}
