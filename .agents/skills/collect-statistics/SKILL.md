---
name: collect-statistics
description: Collect Zip puzzle feature rows, generator parameters, solver metrics, and puzzle statistics into CSV for proficiency, difficulty, model-training, or image-puzzle analysis.
---

# Collect Statistics Skill

Use this skill when collecting feature rows from generated or imported Zip puzzles for proficiency, difficulty, model training, or feature analysis.

## Quick Commands

```sh
npm run collect:statistics
npm run collect:statistics -- --count 100 --rows 5 --cols 5 --target medium
npm run collect:statistics -- --input assets/data/image-puzzles/puzzles.json
npm run collect:statistics -- --input assets/data/image-puzzles
npm run collect:statistics -- --output assets/data/zip-5x5.csv
```

Default output without `--input` is:

```text
assets/data/zip-statistics.csv
```

With `--input`, the output name is derived from the input path:

```text
assets/data/image-puzzles/puzzles.json -> assets/data/puzzles-statistics.csv
assets/data/image-puzzles -> assets/data/image-puzzles-statistics.csv
```

The collector uses the production generator when no input is provided. It always runs the clue-only solver with walls included.

## Reference

Read `references/feature-columns.md` when you need the full CSV schema, feature meanings, solver metric details, or future feature ideas.

## Implementation

Prefer running or patching the scripts in `scripts/` rather than retyping collection logic.
