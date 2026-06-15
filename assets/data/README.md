# Data Directory

This directory is the project’s local puzzle database. Files here fall into four groups: canonical imported puzzles, feature/statistics rows, feedback labels, and training datasets.

## Files

```text
image-puzzles/
```

Canonical Puzzle JSON converted from the five official LinkedIn Zip screenshots. These are useful source examples and should be kept. `puzzles.json` is the combined version used by scripts.

```text
puzzles-statistics.csv
```

Feature vectors for the official imported puzzles. This file contains puzzle geometry, clue/wall/path features, and solver metrics. It does not contain human labels except blank player columns. It can be regenerated with:

```sh
npm run collect:statistics -- --input assets/data/image-puzzles/puzzles.json --max-nodes 1000000
```

```text
feedback/official-linkedin-feedback.csv
```

Seed feedback labels for the five official imported puzzles. These rows set `enjoyment_score` to `1`, because the source puzzles are official Zip puzzles. This file is intentionally small and label-focused.

```text
training/official-linkedin-training.csv
```

Joined supervised training data for the official imported puzzles. It looks similar to `puzzles-statistics.csv`, but it has target labels appended from `feedback/official-linkedin-feedback.csv`. This distinction matters:

- `puzzles-statistics.csv` = features only, useful for analysis and joining.
- `official-linkedin-training.csv` = features plus labels, useful for training a quality model.

Regenerate it with:

```sh
npm run build:training
```

```text
zip-statistics.csv
```

Rolling feature store for generated/evaluated puzzles. The frontend feedback endpoint upserts rows here after you evaluate a candidate puzzle. It is where generated puzzle feature vectors and player summary columns meet.

```text
feedback/human-feedback.csv
```

Created by the frontend when you submit candidate evaluations. This is raw local user feedback and is ignored by git.

Build a local training dataset from frontend feedback with:

```sh
npm run build:training -- \
  --stats assets/data/zip-statistics.csv \
  --feedback assets/data/feedback/human-feedback.csv \
  --output assets/data/training/local-human-training.csv
```

```text
experiments/
```

Local experiment outputs from `npm run optimize:puzzles`. These are ignored by git by default because most runs are exploratory. Keep only named outputs that you plan to evaluate or cite.

## Cleanup Notes

Removed during cleanup:

- `.DS_Store`
- `experiments/smoke-001-history.csv`
- `experiments/smoke-001-top-candidates.json`

Those were smoke-test artifacts and do not carry future modeling value.
