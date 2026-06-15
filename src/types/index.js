/**
 * @typedef {{ row: number, col: number }} Cell
 * @typedef {Cell[]} SolutionPath
 * @typedef {{ number: number, row: number, col: number }} Clue
 * @typedef {{ a: Cell, b: Cell }} Wall
 * @typedef {{ clueDensity: number, wallDensity: number, turnBias: number, symmetryBias: number, pathWiggleFactor: number, clueSpacingBias: number }} GeneratorParameters
 * @typedef {{ rows: number, cols: number, clues: Clue[], walls: Wall[], solution?: SolutionPath, seed?: string, difficulty?: string | null, generatorParameters?: GeneratorParameters }} Puzzle
 */

export {};
