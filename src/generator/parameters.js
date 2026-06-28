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

export const GENERATOR_PARAMETER_RANGES = {
  clueDensity: [0.2, 0.52],
  wallDensity: [0, 0.32],
  turnBias: [0, 1],
  symmetryBias: [0, 1],
  pathWiggleFactor: [0, 1],
  clueSpacingBias: [0.35, 1],
};

export const GENERATOR_PARAMETER_KEYS = Object.keys(GENERATOR_PARAMETER_RANGES);

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
    clueDensity: sampleParameter(rng, 'clueDensity'),
    wallDensity: sampleParameter(rng, 'wallDensity'),
    turnBias: sampleParameter(rng, 'turnBias'),
    symmetryBias: sampleParameter(rng, 'symmetryBias'),
    pathWiggleFactor: sampleParameter(rng, 'pathWiggleFactor'),
    clueSpacingBias: sampleParameter(rng, 'clueSpacingBias'),
  };
}

/**
 * @param {GeneratorParameters} parentA
 * @param {GeneratorParameters} parentB
 * @param {string} seed
 * @returns {GeneratorParameters}
 */
export function crossoverGeneratorParameters(parentA, parentB, seed) {
  const rng = createRng(`generator-parameter-crossover:${seed}`);
  const child = {};

  for (const key of GENERATOR_PARAMETER_KEYS) {
    child[key] = rng() < 0.5 ? parentA[key] : parentB[key];
  }

  return clampGeneratorParameters(child);
}

/**
 * @param {Partial<GeneratorParameters>} parameters
 * @param {string} seed
 * @param {{ mutationRate?: number, mutationStrength?: number }} options
 * @returns {GeneratorParameters}
 */
export function mutateGeneratorParameters(parameters, seed, options = {}) {
  const rng = createRng(`generator-parameter-mutation:${seed}`);
  const mutationRate = clamp01(options.mutationRate ?? 0.35);
  const mutationStrength = clamp01(options.mutationStrength ?? 0.16);
  const mutated = {};

  for (const key of GENERATOR_PARAMETER_KEYS) {
    const [min, max] = GENERATOR_PARAMETER_RANGES[key];
    const baseValue = clampParameter(key, parameters[key] ?? sampleParameter(rng, key));
    if (rng() >= mutationRate) {
      mutated[key] = baseValue;
      continue;
    }

    const span = max - min;
    const delta = (rng() * 2 - 1) * span * mutationStrength;
    mutated[key] = clampParameter(key, baseValue + delta);
  }

  return mutated;
}

/**
 * @param {Partial<GeneratorParameters>} parameters
 * @returns {GeneratorParameters}
 */
export function clampGeneratorParameters(parameters) {
  return {
    clueDensity: clampParameter('clueDensity', parameters.clueDensity ?? DEFAULT_GENERATOR_PARAMETERS.clueDensity),
    wallDensity: clampParameter('wallDensity', parameters.wallDensity ?? DEFAULT_GENERATOR_PARAMETERS.wallDensity),
    turnBias: clampParameter('turnBias', parameters.turnBias ?? DEFAULT_GENERATOR_PARAMETERS.turnBias),
    symmetryBias: clampParameter('symmetryBias', parameters.symmetryBias ?? DEFAULT_GENERATOR_PARAMETERS.symmetryBias),
    pathWiggleFactor: clampParameter(
      'pathWiggleFactor',
      parameters.pathWiggleFactor ?? DEFAULT_GENERATOR_PARAMETERS.pathWiggleFactor,
    ),
    clueSpacingBias: clampParameter(
      'clueSpacingBias',
      parameters.clueSpacingBias ?? DEFAULT_GENERATOR_PARAMETERS.clueSpacingBias,
    ),
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
 * @param {string} key
 * @param {number} value
 */
function clampParameter(key, value) {
  const [min, max] = GENERATOR_PARAMETER_RANGES[key];
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {() => number} rng
 * @param {string} key
 */
function sampleParameter(rng, key) {
  const [min, max] = GENERATOR_PARAMETER_RANGES[key];
  return sampleRange(rng, min, max);
}

/**
 * @param {() => number} rng
 * @param {number} min
 * @param {number} max
 */
function sampleRange(rng, min, max) {
  return min + (max - min) * rng();
}
