---
name: process-images
description: Convert paired solved/unsolved Zip screenshots into Puzzle JSON data.
---

# Process Images

Use this skill when converting paired `*-unsolved.png` and `*-solved.png` Zip screenshots into Puzzle objects.

Run:

```sh
npm run process:images
```

Requires local ImageMagick commands `identify` and `magick`.

The default input directory is:

```text
assets/data/official-images
```

The default output directory is:

```text
assets/data/image-puzzles
```

The converter expects fresh screenshots to be dropped into the top-level data directory as solved/unsolved pairs:

```text
assets/data/official-images/11-6-unsolved.png
assets/data/official-images/11-6-solved.png
```

It detects:

1. grid lines from the unsolved screenshot,
2. clue cells from black clue circles,
3. clue `1` from the purple highlighted start cell,
4. walls from thick black cell boundaries,
5. the solution from the orange solved path.

Clue numbers are inferred by sorting clue cells along the recovered solution path. Keep `difficulty` as `null` for imported examples.

# Puzzle Format

```js
/**
 * @typedef {{ row: number, col: number }} Cell
 * @typedef {Cell[]} SolutionPath
 * @typedef {{ number: number, row: number, col: number }} Clue
 * @typedef {{ a: Cell, b: Cell }} Wall
 * @typedef {{ rows: number, cols: number, clues: Clue[], walls: Wall[], solution?: SolutionPath, seed?: string, difficulty?: string | null }} Puzzle
 */
```
