# Infinite Zip

Infinite Zip is a deterministic Zip puzzle generator, solver, web player, and experimentation workspace.

The core rule from `.agents/AGENTS.md` still governs the project: puzzles are generated algorithmically, then validated by the solver for solvability and uniqueness. Learned models may score or rank puzzles, but they must not generate puzzle structure directly.

## Directory Map

```text
.agents/
  AGENTS.md                  Canonical Zip rules and generator constraints.
  AGENTS2.md                 Iterative improvement and learned-ranking roadmap.
  ITERATIVE_IMPROVEMENT.md   Current optimization loop notes.
  skills/                    Local workflow skills and reusable skill scripts.
    clean-ds-stores/         Reusable .DS_Store cleanup skill and hook script.

assets/
  data/                      Puzzle data, feature CSVs, feedback, training rows.
    official-images/         Fresh solved/unsolved screenshot pairs for conversion.

scripts/
  serve.mjs                  Local web server and feedback write endpoint.
  experiments/               Experiment and training dataset command scripts.
  model/                     XGBoost training scripts for the learned scorer.

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
npm run train:model
npm run optimize:puzzles -- --count 1000 --top 3 --experiment-id search-001
npm run optimize:puzzles -- --algorithm evolutionary --count 1000 --top 16 --experiment-id evo-001
```

## Deployment

For a free full-stack preview, use the Render blueprint in `render.yaml`. See `DEPLOYMENT.md` for setup notes and caveats about local filesystem persistence.

## Local Git Cleanup

To delete `.DS_Store` files on demand:

```sh
sh .agents/skills/clean-ds-stores/scripts/clean-ds-stores.sh
```

To install a local pre-commit hook that runs the cleanup before each commit:

```sh
sh .agents/skills/clean-ds-stores/scripts/clean-ds-stores.sh --install-hook
```

Codex can also use the local `clean-ds-stores` skill when this cleanup is useful. The script lives with the skill so it can be copied into other repositories as a small reusable tool.

## Feedback Flow

The frontend is organized around the iterative loop:

```text
auto-generate candidate -> play Zip -> submit feedback -> save rows back to the repo
```

Start the app with:

```sh
npm start
```

The frontend shows one generated puzzle at a time using fixed hidden defaults for the current evaluation loop. After playing, `Save & Next` writes the feedback row and puzzle feature row through the local server, then advances to a fresh puzzle. `Hint` reveals the solution and increments the hint count.

If `assets/data/experiments/*-top-candidates.json` files exist, the local server serves the newest one to the frontend first. The app walks through that ranked Top N batch for human evaluation. When the batch is exhausted, it stops and asks for a new retrain/batch run instead of silently showing one-off generated puzzles.

The header under the puzzle title shows whether the current puzzle came from a candidate batch or from fresh default generation. Use `Retrain & Batch` to rebuild the local training CSV, retrain the XGBoost artifact, generate a new ranked Top 16 candidate batch, and load it into the board. Each retrain run uses a fresh seed prefix plus higher evolutionary exploration/mutation settings, which is this project’s equivalent of raising sampling temperature.

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

Train the first XGBoost quality model with:

```sh
python3 -m pip install --user -r requirements-ml.txt
npm run train:model
```

Model artifacts are written under `models/` and ignored by git. The current official baseline labels are all `1`, so the first model proves the pipeline but will not learn real preferences until local human evaluations add varied labels.

`npm run optimize:puzzles` now uses the trained model in `auto` mode when `models/puzzle_quality-metadata.json` and the model artifact exist. It falls back to the bootstrap scorer on a clean checkout, and also falls back when the current model metadata says the target labels are constant. You can force a mode with:

```sh
npm run optimize:puzzles -- --scorer xgboost
npm run optimize:puzzles -- --scorer bootstrap
```

It also supports evolutionary generator-parameter search:

```sh
npm run optimize:puzzles -- --algorithm evolutionary --population-size 40 --elite-count 8
```

## Data Policy

Keep canonical examples and reusable derived datasets. Ignore or delete throwaway experiment outputs unless they document a decision or are needed as seed candidates for a future evaluation session.
