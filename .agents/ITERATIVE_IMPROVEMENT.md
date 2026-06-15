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

Outputs:

```text
assets/data/experiments/search-001-history.csv
assets/data/experiments/search-001-top-candidates.json
```

The history CSV stores:

- generator parameters,
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

The app presents one candidate puzzle at a time on the normal play board. After playing, submit:

- enjoyment score,
- difficulty rating,
- hint count,
- solve time,
- completion status.

Feedback is stored in browser localStorage and can be exported as CSV from the app.

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

## Human Feedback

Only the final Top 3 candidates should be shown for human evaluation.

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

## Future Phases

1. Train `XGBRegressor` from human-labeled rows.
2. Replace the bootstrap scorer with XGBoost prediction.
3. Add evolutionary search over `GeneratorParameters`.
4. Add local mutation operators:
   - `moveClue`
   - `addWall`
   - `removeWall`
   - `swapClues`
   - `changePathSegment`
5. Validate every mutation through the solver before scoring.
6. Store the Puzzle itself as well as the extracted features as feature vectors
7. Store the generator parameters in the csv
