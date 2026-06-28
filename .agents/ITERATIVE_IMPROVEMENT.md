# Iterative Improvement Framework

This project keeps two responsibilities separate:

1. The Zip generator remains algorithmic and solver-validated.
2. The quality model ranks valid generated puzzles.

The learned model must never create puzzle structure directly.

## Current Loop

Run a parameter-search experiment:

```sh
npm run optimize:puzzles -- --count 1000 --rows 6 --cols 6 --top 3 --experiment-id search-001
```

Run the evolutionary parameter-search phase:

```sh
npm run optimize:puzzles -- \
  --algorithm evolutionary \
  --count 1000 \
  --population-size 40 \
  --elite-count 8 \
  --top 16 \
  --experiment-id evo-001
```

Outputs:

```text
assets/data/experiments/search-001-history.csv
assets/data/experiments/search-001-top-candidates.json
```

The history CSV stores:

- generator parameters,
- search algorithm, generation, and parent IDs,
- full extracted feature vector,
- solver metrics,
- ranking score,
- generation status.

The candidate JSON stores only the retained Top N puzzles for later human review.

## Frontend Human Evaluation

Start the app:

```sh
npm start
```

In the evaluation panel, load a Top N candidate file such as:

```text
assets/data/experiments/search-001-top-candidates.json
```

The local app automatically loads the newest `assets/data/experiments/*-top-candidates.json` file when one exists. It presents one candidate puzzle at a time on the normal play board. After playing, submit:

- enjoyment score,
- difficulty rating,
- hint count,
- solve time,
- completion status.

Feedback is stored in browser localStorage and posted to the local repo through `/api/feedback`.

## Generator Parameters

The current parameter chromosome is:

```ts
type GeneratorParameters = {
  clueDensity: number;
  wallDensity: number;
  turnBias: number;
  symmetryBias: number;
  pathWiggleFactor: number;
  clueSpacingBias: number;
};
```

Immediately active:

- `clueDensity`
- `wallDensity`
- `clueSpacingBias`

Reserved for the next mutation/generation phases:

- `turnBias`
- `symmetryBias`
- `pathWiggleFactor`

These are still logged now so historical rows keep a stable schema as the generator becomes more expressive.

## Scoring

`src/optimization/scoring.js` is a temporary scoring seam. It currently emits:

```text
scorer_name=bootstrap_exploration_v0
predicted_quality_score=
ranking_score=<number>
```

When an XGBoost model exists, replace this seam so:

```text
predicted_quality_score = model.predict(feature_vector)
ranking_score = predicted_quality_score
```

Do not fold handcrafted quality rules into the final learned scorer.

Current implementation:

```text
--scorer auto      Use XGBoost when local artifacts exist, otherwise bootstrap.
--scorer xgboost   Require model prediction and fail if artifacts/dependencies are missing.
--scorer bootstrap Use handcrafted exploration score.
```

`optimize:puzzles` batch-scores generated candidate feature rows through `scripts/model/predict_quality.py` so the XGBoost model influences candidate ranking without changing puzzle construction itself.

## Search

Current implementation:

```text
--algorithm random        Uniform generator-parameter sampling baseline.
--algorithm evolutionary  Score populations, retain elite parameter sets, then mutate/crossover offspring.
```

Evolutionary search still only changes `GeneratorParameters`. Every candidate puzzle is generated algorithmically and validated by the solver before ranking.

The frontend `Retrain & Batch` flow uses a fresh seed prefix for every run and hotter search settings (`mutationRate=0.55`, `mutationStrength=0.32`, `explorationRate=0.35`) so repeated batches do not begin from the same deterministic population.

## Human Feedback

Only the retained Top N candidates should be shown for human evaluation. The frontend retrain flow currently keeps 16 ranked candidates so lower-ranked-but-still-scored puzzles are evaluated before any fresh fallback generation.

Feedback rows should include:

```csv
puzzle_id,enjoyment_score,difficulty_rating,hint_count,solve_time_seconds,completed
```

Only human-labeled candidates should enter the model training dataset.

The first five imported official LinkedIn Zip puzzles are seeded as baseline feedback with:

```text
enjoyment_score=1
```

Those rows live at:

```text
assets/data/feedback/official-linkedin-feedback.csv
```

Build a joined training dataset with:

```sh
npm run build:training
```

Train the initial XGBoost quality model with:

```sh
python3 -m pip install --user -r requirements-ml.txt
npm run train:model
```

Outputs:

```text
models/puzzle_quality.ubj
models/puzzle_quality-metadata.json
models/puzzle_quality-feature-importance.csv
```

The model currently trains on `enjoyment_score`. Feedback-derived columns are excluded from inputs to avoid target leakage. With only official baseline rows, the target is constant at `1`, so this first artifact is a pipeline checkpoint rather than a meaningful preference model.

## Future Phases

1. Add varied human-labeled rows through frontend evaluation.
2. Replace the bootstrap scorer with XGBoost prediction.
3. Add evolutionary search over `GeneratorParameters`. Done as `--algorithm evolutionary`.
4. Add local mutation operators:
   - `moveClue`
   - `addWall`
   - `removeWall`
   - `swapClues`
   - `changePathSegment`
5. Validate every mutation through the solver before scoring.
6. Store the Puzzle itself as well as the extracted features as feature vectors
7. Store the generator parameters in the csv
