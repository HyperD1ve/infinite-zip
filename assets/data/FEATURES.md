# Zip Feature Dictionary

This document names the signals currently stored for puzzle analysis and the generator knobs we can tune. It is meant to be plain enough to critique after playing puzzles.

## Puzzle Identity And Generator Settings

These columns describe where a row came from and which generator parameters produced it.

| Column | Meaning |
| --- | --- |
| `id` | Puzzle identifier, usually the seed. |
| `generator_clue_density` | Target fraction of cells that should become numbered clues. Lower values usually make puzzles harder. |
| `generator_wall_density` | Target wall density used by wall generation. Higher values can add constraints and maze-like structure. |
| `generator_turn_bias` | Reserved/experimental preference for paths with more turns. Logged now so historical data keeps a stable schema. |
| `generator_symmetry_bias` | Reserved/experimental preference for symmetric clue/wall layouts. |
| `generator_path_wiggle_factor` | Reserved/experimental preference for less straight, more winding solution paths. |
| `generator_clue_spacing_bias` | Preference for spreading clues along the solution path instead of bunching them together. |

## Basic Puzzle Shape

| Column | Meaning |
| --- | --- |
| `rows` | Board row count. |
| `cols` | Board column count. |
| `clues` | Number of numbered clues. |
| `walls` | Number of walls between adjacent cells. |
| `wall_density` | `walls / possible_internal_walls`; normalized wall count across board sizes. |

## Clue Placement Features

| Column | Meaning |
| --- | --- |
| `corner_clue_count` | Number of clues placed in the four corners. |
| `edge_clue_count` | Number of non-corner clues on the board edge. |
| `center_clue_count` | Number of clues away from edges and corners. |
| `clue_spacing_entropy` | Entropy of gaps between clues along the solved path. Higher means clue gaps are more varied/evenly distributed. |
| `clue_heatmap_entropy` | Entropy of clue counts across board quadrants. Higher means clues are more spatially spread out. |

## Solution Path Features

| Column | Meaning |
| --- | --- |
| `turn_count` | Number of direction changes in the solution path. |
| `path_self_proximity` | Minimum Manhattan distance between non-neighboring cells along the solution path. Low values mean the path folds near itself. |
| `mean_path_self_proximity` | Average Manhattan distance between non-neighboring path cells. Lower values mean a denser/tighter path. |

## Symmetry Features

These compare clue and wall tokens against reflected/rotated versions of the same puzzle.

| Column | Meaning |
| --- | --- |
| `reflection_symmetry` | Fraction of clue/wall tokens preserved by horizontal reflection across columns. |
| `rotational_symmetry` | Fraction of clue/wall tokens preserved by 180-degree rotation. |
| `overall_symmetry` | Average of reflection and rotational symmetry. |

## Solver Metrics

These come from the clue-only uniqueness solver. They describe how hard the puzzle is for the solver, not necessarily how hard it feels to a human.

| Column | Meaning |
| --- | --- |
| `solver_nodes_visited` | Number of DFS states explored. |
| `solver_backtracks` | Number of times the solver undid a choice. |
| `average_branching_factor` | Average candidate count at branching points: `branchChoices / branchingEvents`. |
| `solution_count` | Number of solutions found up to the configured solver cap. Valid training candidates should usually be `1`. |

## Player Feedback Features

These are filled when a player evaluates a puzzle in the frontend.

| Column | Meaning |
| --- | --- |
| `player_solve_rate` | `1` when the submitted attempt was completed, otherwise `0`. |
| `player_avg_time` | Solve/evaluation time in seconds for the submitted playthrough. |
| `player_hint_rate` | Hint count from the submitted playthrough. |
| `player_like_score` | Enjoyment score copied into the feature store. |
| `enjoyment_score` | Supervised training target from feedback CSVs. Currently a 0-9 frontend score. |
| `difficulty_rating` | Player difficulty label: `too_easy`, `easy`, `medium`, or `hard`. `hard` is the currently desired label. |
| `hint_count` | Raw submitted hint count. |
| `solve_time_seconds` | Raw submitted elapsed time. |
| `completed` | Raw submitted completion flag. |

## Current Generator Knobs

These are the parameters we actively sample or preset when generating puzzles.

| Knob | Current role |
| --- | --- |
| `clueDensity` | Controls how many clues the puzzle starts with. |
| `wallDensity` | Controls how many walls are generated. |
| `clueSpacingBias` | Controls how strongly clues are spread along the solution path. |

## Logged But Still Developing

These are recorded in CSVs and sampled in experiments, but their deeper generator behavior is still a future improvement target.

| Knob | Intended future role |
| --- | --- |
| `turnBias` | Prefer solution paths with more or fewer turns. |
| `symmetryBias` | Prefer more symmetric walls/clues. |
| `pathWiggleFactor` | Prefer more winding or more direct solution paths. |

## Notes For Future Feature Ideas

Good human-facing features to consider next:

- forced-corridor count,
- bottleneck cells,
- number of local path traps,
- distance between consecutive clues by grid distance, not only path distance,
- wall segments that create meaningful deductions,
- amount of early ambiguity before clue 2,
- whether the final clue feels like a satisfying endpoint.
