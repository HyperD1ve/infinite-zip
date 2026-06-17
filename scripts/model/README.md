# Model Scripts

This directory contains the learned quality-model tooling for the iterative Zip improvement loop.

## Train The Initial XGBoost Model

Build or refresh the joined training CSV first:

```sh
npm run build:training
```

Install the local ML dependencies:

```sh
python3 -m pip install -r requirements-ml.txt
```

Train:

```sh
npm run train:model
```

Default outputs:

```text
models/puzzle_quality.ubj
models/puzzle_quality-metadata.json
models/puzzle_quality-feature-importance.csv
```

The model consumes numeric puzzle feature columns and predicts `enjoyment_score`. Feedback-derived columns such as `player_like_score`, `hint_count`, and `solve_time_seconds` are excluded as model inputs to avoid leaking the target back into prediction.

The current official dataset is intentionally tiny and has a constant enjoyment label, so the first artifact is mainly a pipeline check. It becomes useful for ranking once local human evaluations add varied labels.

## Use During Optimization

`npm run optimize:puzzles` defaults to `--scorer auto`. In auto mode, it uses this model when the metadata and model artifact exist, otherwise it falls back to the bootstrap exploration scorer.

Force model scoring:

```sh
npm run optimize:puzzles -- --scorer xgboost --count 1000 --top 3
```

Force the old handcrafted scorer:

```sh
npm run optimize:puzzles -- --scorer bootstrap --count 1000 --top 3
```

The optimization loop scores generated candidate feature rows in batches via `predict_quality.py`; the model ranks puzzles, but the algorithmic generator and solver still decide which puzzles are valid.
