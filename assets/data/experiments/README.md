# Experiments

This directory receives outputs from:

```sh
npm run optimize:puzzles
```

The optimizer supports both the random baseline and evolutionary parameter search:

```sh
npm run optimize:puzzles -- --algorithm random --count 100 --top 3
npm run optimize:puzzles -- --algorithm evolutionary --count 1000 --population-size 40 --elite-count 8 --top 3
```

Each run can produce:

```text
<experiment-id>-history.csv
<experiment-id>-top-candidates.json
```

History rows include search metadata (`search_algorithm`, `search_generation`, `parent_a_id`, `parent_b_id`), the full puzzle feature vector, generator parameters, solver metrics, and scoring columns.

Most experiment outputs are local scratch data and are ignored by git. Keep a run only if it is being used for frontend evaluation, model comparison, or analysis.
