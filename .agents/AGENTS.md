# AGENTS.md

## Project Overview

Build a production-quality web implementation of a puzzle game inspired by LinkedIn Zip.

The game consists of:

* A rectangular grid.
* A hidden path that visits every cell exactly once.
* Numbered clue cells that must be connected in ascending order.
* The player's goal is to reconstruct the entire path.

The system must support generation of an effectively unlimited number of puzzles with guaranteed solvability and uniqueness.

---

# Core Principle

DO NOT use LLMs or AI models to generate puzzles.

Puzzle generation must be algorithmic and deterministic.

AI may only be used in optional future features such as:

* Hint generation
* Difficulty prediction
* Analytics
* Tutorial explanations

The puzzle generator itself must be implemented using graph algorithms and constraint solving.

---

# Architecture

Separate the codebase into:

```text
/src
    /game
        board.ts
        path.ts
        puzzle.ts

    /generator
        generateSolution.ts
        generateClues.ts
        uniquenessChecker.ts
        difficulty.ts

    /solver
        solve.ts
        constraints.ts

    /ui
        components/

    /types
```

Maintain strict separation between:

1. Puzzle generation
2. Puzzle solving
3. Difficulty analysis
4. Frontend rendering

---

# Data Model

Represent a solution path as an ordered list of coordinates.

Example:

```ts
type Cell = {
    row: number;
    col: number;
};

type SolutionPath = Cell[];
```

A path length must equal:

```ts
rows * cols
```

Every cell must appear exactly once.

---

# Puzzle Representation

A puzzle should contain:

```ts
type Puzzle = {
    rows: number;
    cols: number;

    clues: {
        number: number;
        row: number;
        col: number;
    }[];

    solution: SolutionPath;
};
```

The solution should never be sent to players in production mode.

---

# Generation Pipeline

Generation must follow this order:

## Step 1

Generate a complete valid Hamiltonian-style path that visits every cell exactly once.

Possible techniques:

* Randomized DFS
* Backtracking
* Hamiltonian path construction

Requirements:

* Every cell visited exactly once
* Path must be continuous
* No disconnected regions

---

## Step 2

Select clue locations along the path.

Example:

```text
Path length = 36

1 -> step 1
2 -> step 8
3 -> step 15
4 -> step 22
5 -> step 36
```

Clues should be distributed across the board.

Avoid clustering.

---

## Step 3

Run the solver using ONLY clue information.

The solver must not access the hidden solution.

---

## Step 4

Count solutions.

Outcomes:

```text
0 solutions = invalid
1 solution = valid
2+ solutions = reject
```

Only puzzles with exactly one solution are acceptable.

---

# Solver Requirements

Implement a complete constraint solver.

The solver should:

* Reconstruct paths
* Enforce clue ordering
* Enforce adjacency constraints
* Prevent revisiting cells
* Verify full coverage

The solver must be capable of proving uniqueness.

Do not use brute force unless heavily pruned.

Use constraint propagation wherever possible.

---

# Difficulty System

Difficulty must be solver-based.

Never assign difficulty randomly.

Metrics may include:

* Forced moves
* Search depth
* Branching factor
* Number of deductions required
* Backtracking count

Example:

```text
Easy
    Mostly forced moves

Medium
    Several branching decisions

Hard
    Requires lookahead

Expert
    Significant search depth
```

---

# Reverse Clue Removal Strategy

Preferred generation method:

1. Generate solved board.
2. Start with many clues.
3. Remove clues one at a time.
4. Check uniqueness after each removal.
5. Stop when uniqueness is lost.

This generally produces stronger puzzles.

---

# Frontend Requirements

Build a modern responsive web UI.

Preferred stack:

* React
* TypeScript
* Vite
* Tailwind

Features:

* Desktop support
* Mobile support
* Touch support
* Mouse support

---

# Gameplay Requirements

Player actions:

* Click/touch cells
* Drag between cells
* Draw path segments
* Remove path segments
* Restart puzzle
* Undo move

Validation:

* Show invalid connections
* Show completed puzzle state
* Prevent impossible moves where practical

---

# Visual Design

Clean minimalist style.

Inspiration:

* LinkedIn Games
* NYT Games
* Apple Human Interface Guidelines

Requirements:

* Fast load time
* Minimal animations
* Accessible color contrast
* Keyboard navigation

---

# Performance Targets

Generation:

```text
Small board:
<100ms

Medium board:
<500ms

Large board:
<2s
```

Gameplay:

```text
60 FPS interactions
```

---

# Testing

Required tests:

## Generator

* Every generated puzzle is solvable.
* Every generated puzzle has exactly one solution.

## Solver

* Correctly solves known puzzles.
* Rejects invalid puzzles.

## Difficulty

* Produces stable difficulty ratings.

## UI

* Drag interactions work on desktop.
* Drag interactions work on touch devices.

---

# Code Quality

Requirements:

* TypeScript strict mode.
* No any types.
* Small focused modules.
* Pure functions where possible.
* Full unit test coverage for solver and generator.

---

# Deliverables

Build in this order:

1. Core data structures.
2. Solver.
3. Solution generator.
4. Uniqueness checker.
5. Difficulty system.
6. React frontend.
7. Mobile interaction layer.
8. Persistence and puzzle packs.

Do not begin frontend work until the solver and uniqueness checker are functioning correctly.

The solver is the source of truth for puzzle correctness.
