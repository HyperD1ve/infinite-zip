# Collect Statistics Feature Columns

Use this reference when you need the exported CSV schema, feature meanings, or feature-idea notes.

## Generator Parameters

Generated puzzles include the generator parameters that produced them:

```csv
generator_clue_density,generator_wall_density,generator_turn_bias,generator_symmetry_bias,generator_path_wiggle_factor,generator_clue_spacing_bias
```

Imported puzzle rows leave these blank unless the Puzzle JSON includes `generatorParameters`.

## Solver Metrics

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

## Final CSV Columns

```csv
id,generator_clue_density,generator_wall_density,generator_turn_bias,generator_symmetry_bias,generator_path_wiggle_factor,generator_clue_spacing_bias,rows,cols,clues,walls,corner_clue_count,edge_clue_count,center_clue_count,clue_spacing_entropy,turn_count,path_self_proximity,mean_path_self_proximity,wall_density,clue_heatmap_entropy,reflection_symmetry,rotational_symmetry,overall_symmetry,solver_nodes_visited,solver_backtracks,average_branching_factor,solution_count,player_solve_rate,player_avg_time,player_hint_rate,player_like_score
```

## Feature Ideas

Consider these future features when improving the model:

1. How many numbered points are there relative to the board?
2. How far apart is the next numbered point along the solution path?
3. How far apart is the next numbered point physically by Manhattan distance?
4. How many turns are in the solution path?
5. What are the mean and variance of continuous wall lengths?
6. What is the maximum number of solutions found under a solver cap?
7. What is the largest blank rectangle or square?
8. What is the average number of non-single-block blank rectangles, including overlaps?
