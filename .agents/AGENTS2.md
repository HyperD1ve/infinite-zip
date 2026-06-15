# AGENTS.md

## Goal

Build a self-improving Zip puzzle generation system.

The system must:

1. Learn from player feedback.
2. Train an XGBoost quality model.
3. Use that model to rank generated puzzles.
4. Iteratively improve puzzles through mutation.
5. Continuously grow the training dataset.

The XGBoost model is NOT a puzzle generator.

The puzzle generator remains algorithmic.

The XGBoost model acts as a learned evaluation function.

---

# Core Architecture

```text
Puzzle Generator
        ↓
Feature Extraction
        ↓
XGBoost Quality Model
        ↓
Predicted Quality Score
```

The generator creates puzzles.

The model scores puzzles.

Search algorithms decide which puzzles to generate next.

---

# Phase 1: Train Initial Quality Model

Load historical puzzle statistics from CSV.

Example:

```text
data/puzzle_features.csv
```

Features include:

* clue counts
* wall statistics
* entropy metrics
* solver metrics
* symmetry metrics
* path metrics

Initial target may be:

```text
enjoyment_score
```

or

```text
quality_score
```

if a handcrafted score exists.

Train:

```python
XGBRegressor
```

Persist model to disk.

Example:

```text
models/puzzle_quality.xgb
```

---

# Phase 2: Global Search Over Generator Parameters

The generator must expose tunable parameters.

```ts
type GeneratorParameters = {
    clueDensity: number;
    wallDensity: number;
    turnBias: number;
    symmetryBias: number;
    pathWiggleFactor: number;
    clueSpacingBias: number;
}
```

Generate:

```text
1000 puzzles
```

using randomized parameter combinations.

For each puzzle:

```text
Generate
→ Validate
→ Feature Extract
→ XGBoost Score
```

Keep:

```text
Top 3 puzzles only
```

These become mutation seeds.

---

# Search Algorithms

Support:

## Random Search

Sample generator parameters uniformly.

Use as baseline.

---

## Evolutionary Search

Treat generator parameters as chromosomes.

Example:

```text
[
  clueDensity,
  wallDensity,
  turnBias,
  symmetryBias,
  pathWiggleFactor,
  clueSpacingBias
]
```

Mutate and crossover.

Keep highest scoring populations.

---

## Bayesian Optimization

Optional.

Use when generation cost becomes expensive.

Objective:

```text
maximize predicted_quality_score
```

over generator parameter space.

---

## CMA-ES

Optional advanced search.

Recommended after baseline system is working.

Useful for continuous parameter optimization.

---

# Phase 3: Local Search Over Puzzle Space

For each of the Top 3 puzzles:

Perform:

```text
1000 mutation iterations
```

Pipeline:

```text
Puzzle
    ↓
Mutate
    ↓
Validate
    ↓
Extract Features
    ↓
Score
    ↓
Accept or Reject
```

---

# Mutation Operators

Implement:

```ts
moveClue()

addWall()

removeWall()

swapClues()

changePathSegment()
```

Requirements:

* puzzle remains valid
* puzzle remains solvable
* puzzle remains uniquely solvable

Reject invalid mutations immediately.

---

# Mutation Acceptance

Use hill climbing initially.

```text
If score improves:
    accept

Else:
    reject
```

Future upgrades:

* Simulated annealing
* Evolutionary local search
* MCTS

---

# Puzzle Quality Score

The model predicts:

```text
predicted_quality
```

which is learned from player feedback.

Do not manually hardcode quality rules.

Allow the model to learn them.

---

# Phase 4: Human Evaluation

Present only the final Top 3 puzzles.

Do NOT show all generated puzzles.

Collect:

```text
enjoyment_score
```

Range:

```text
0-9
```

slider

---

Collect:

```text
difficulty_rating
```

Options:

```text
over_easy
easy
hard
over_hard
```

Goal:

```text
easy → hard
```

Avoid:

```text
over_easy
over_hard
```

---

Collect:

```text
hint_count
```

integer

---

Collect:

```text
solve_time_seconds
```

---

Collect:

```text
completed
```

boolean

---

# Human Feedback Dataset

Store one row per played puzzle.

Example:

```csv
puzzle_id,
enjoyment_score,
difficulty_rating,
hint_count,
solve_time_seconds,
completed
```

---

# Phase 5: Training Data Growth

Only append the final Top 3 evaluated puzzles.

Never append all 1000 generated puzzles.

Reason:

Generated puzzles have no human feedback.

Only puzzles with human labels should enter the training set.

---

# Training Dataset Structure

Final training row:

```csv
puzzle_id,

corner_clue_count,
edge_clue_count,
center_clue_count,

clue_spacing_entropy,

turn_count,

path_self_proximity,
mean_path_self_proximity,

wall_density,

reflection_symmetry,
rotational_symmetry,
overall_symmetry,

solver_nodes_visited,
solver_backtracks,
average_branching_factor,

solution_count,

enjoyment_score,
difficulty_rating,
hint_count,
solve_time_seconds,
completed
```

---

# Retraining Strategy

After every new batch:

```text
append rows
```

When enough new data exists:

```text
retrain model
```

Example threshold:

```text
every 100 new human-labeled puzzles
```

---

# Long-Term Objective

The final system becomes:

```text
Generator
    ↓

Global Search
(parameter optimization)

    ↓

Top 3 Candidates

    ↓

Local Mutation Search
(1000 iterations)

    ↓

Final Candidates

    ↓

Human Feedback

    ↓

Dataset Growth

    ↓

XGBoost Retraining

    ↓

Better Future Puzzle Selection
```

The generator guarantees correctness.

The solver guarantees uniqueness.

The XGBoost model learns player preferences.

Search algorithms explore puzzle space using the model as a fitness function.
