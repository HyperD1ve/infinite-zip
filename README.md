# Infinite Zip

Infinite Zip is a deterministic Zip puzzle generator, solver, web player, and experimentation workspace.

The core rule from `.agents/AGENTS.md` still governs the project: puzzles are generated algorithmically, then validated by the solver for solvability and uniqueness. Learned models may score or rank puzzles, but they must not generate puzzle structure directly.

## Directory Map

```text
.agents/
  AGENTS.md                  Canonical Zip rules and generator constraints.
  AGENTS2.md                 Iterative improvement and learned-ranking roadmap.
  ITERATIVE_IMPROVEMENT.md   Current optimization loop notes.
  skills/                    Local workflow notes and scripts.

assets/
  data/                      Puzzle data, feature CSVs, feedback, training rows.

scripts/
  serve.mjs                  Local web server and feedback write endpoint.
  experiments/               Experiment and training dataset command scripts.

src/
  game/                      Board, path, wall, and puzzle validation.
  generator/                 Algorithmic puzzle generation.
  optimization/              Ranking/scoring seam for search and future XGBoost.
  solver/                    Clue-only uniqueness solver.
  types/                     Shared JSDoc typedefs.
  ui/                        Browser app, board rendering, input, feedback capture.

test/                        Node test suite.
```

## Common Commands

```sh
npm start
npm test
npm run process:images
npm run collect:statistics -- --input assets/data/image-puzzles/puzzles.json
npm run build:training
npm run optimize:puzzles -- --count 1000 --top 3 --experiment-id search-001
```

## Feedback Flow

The frontend evaluation panel loads a `*-top-candidates.json` file, presents candidates one at a time, and writes submitted feedback back into the local repo through `npm start`.

Feedback writes to:

```text
assets/data/feedback/human-feedback.csv
assets/data/zip-statistics.csv
```

`human-feedback.csv` is raw local feedback and is ignored by git. `zip-statistics.csv` is the rolling feature store for generated/evaluated puzzles; when feedback is submitted, the app upserts the puzzle feature vector there and fills the player feedback summary columns.

Build a training CSV from generated/evaluated frontend feedback with:

```sh
npm run build:training -- \
  --stats assets/data/zip-statistics.csv \
  --feedback assets/data/feedback/human-feedback.csv \
  --output assets/data/training/local-human-training.csv
```

## Data Policy

Keep canonical examples and reusable derived datasets. Ignore or delete throwaway experiment outputs unless they document a decision or are needed as seed candidates for a future evaluation session.
