---
name: collect-statistics
description: Generate Zip puzzles, collect puzzle and solver statistics, and export them as CSV.
---

# Collect Statistics Skill

Use this skill when collecting feature rows from generated Zip puzzles for proficiency or difficulty analysis.

Run:

```sh
npm run collect:statistics
```

The default output is:

```text
assets/data/zip-statistics.csv
```

Useful options:

```sh
npm run collect:statistics -- --count 100 --rows 5 --cols 5 --target medium
npm run collect:statistics -- --input assets/data/image-puzzles/puzzles.json
npm run collect:statistics -- --input assets/data/image-puzzles
npm run collect:statistics -- --output assets/data/zip-5x5.csv
```

With `--input`, the default output is based on the input name. For example:

```text
assets/data/image-puzzles/puzzles.json -> assets/data/puzzles-statistics.csv
assets/data/image-puzzles -> assets/data/image-puzzles-statistics.csv
```

Without `--input`, the collector uses the production generator. Either way, it runs the clue-only solver with walls included.

Generated puzzles include the generator parameters that produced them:

```csv
generator_clue_density,generator_wall_density,generator_turn_bias,generator_symmetry_bias,generator_path_wiggle_factor,generator_clue_spacing_bias
```

Imported puzzle rows leave these blank unless the Puzzle JSON includes `generatorParameters`.

Solver metrics are logged as:

```ts
interface SolverStats {
  nodesVisited: number;
  backtracks: number;
  branchingEvents: number;
  branchChoices: number;
}
```

`average_branching_factor` is computed as:

```text
branchChoices / branchingEvents
```

When there are no branching events, the exported value is `0`.

# Feature Ideas

When considering how to use the processed data:

Consider:

1. How many points are there, relative to the board (what's the ratio)?
2. How far apart is the next numbered point on the path?
3. How far apart is the next numbered point physically (Manhattan distance)?
4. How many turns are in the solution path?
5. What's the mean and variance of length of continuous walls?
6. What are the max number of solutions to the game?
7. What is the largest rectangle / square I can draw such that it only encompasses blank spaces?
8. What is the average number of non-single-block blank rectangles I can draw (including overlaps)?



# Final CSV Columns

```csv
id,generator_clue_density,generator_wall_density,generator_turn_bias,generator_symmetry_bias,generator_path_wiggle_factor,generator_clue_spacing_bias,rows,cols,clues,walls,corner_clue_count,edge_clue_count,center_clue_count,clue_spacing_entropy,turn_count,path_self_proximity,mean_path_self_proximity,wall_density,clue_heatmap_entropy,reflection_symmetry,rotational_symmetry,overall_symmetry,solver_nodes_visited,solver_backtracks,average_branching_factor,solution_count,player_solve_rate,player_avg_time,player_hint_rate,player_like_score
```
