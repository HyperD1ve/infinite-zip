#!/usr/bin/env python3
"""Train the Zip puzzle quality model.

This is the first learned scorer step in the iterative-improvement loop. It
loads the joined training CSV, trains an XGBRegressor on numeric puzzle
features, and persists both the model and the feature-column metadata needed
for later prediction.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO_ROOT / "assets" / "data" / "training" / "official-linkedin-training.csv"
DEFAULT_MODEL_OUTPUT = REPO_ROOT / "models" / "puzzle_quality.ubj"
DEFAULT_METADATA_OUTPUT = REPO_ROOT / "models" / "puzzle_quality-metadata.json"
DEFAULT_IMPORTANCE_OUTPUT = REPO_ROOT / "models" / "puzzle_quality-feature-importance.csv"

EXCLUDED_COLUMNS = {
    "id",
    "puzzle_id",
    "enjoyment_score",
    "difficulty_rating",
    "hint_count",
    "solve_time_seconds",
    "completed",
    "player_solve_rate",
    "player_avg_time",
    "player_hint_rate",
    "player_like_score",
}

REQUIRED_FEATURE_COLUMNS = [
    "generator_clue_density",
    "generator_wall_density",
    "generator_turn_bias",
    "generator_symmetry_bias",
    "generator_path_wiggle_factor",
    "generator_clue_spacing_bias",
]


def main() -> None:
    args = parse_args()

    try:
        import numpy as np
        from xgboost import XGBRegressor
        import xgboost
        import sklearn
    except ModuleNotFoundError as error:
        missing = error.name or "xgboost"
        raise SystemExit(
            f"Missing Python package '{missing}'. Install local ML dependencies with:\n"
            "  python3 -m pip install -r requirements-ml.txt"
        ) from error

    rows = read_csv(args.input)
    feature_columns = choose_feature_columns(rows, args.target)
    x, y, row_ids = build_matrix(rows, feature_columns, args.target, np)

    if len(y) < args.min_rows:
        raise SystemExit(f"Need at least {args.min_rows} labeled rows; found {len(y)}.")

    distinct_targets = sorted(set(float(value) for value in y))
    if len(distinct_targets) == 1:
        print(
            "Warning: target column is constant. The model artifact is useful "
            "for pipeline wiring, but it cannot learn preferences yet."
        )

    train_indices, holdout_indices = split_indices(len(y), args.holdout_fraction, args.seed, np)
    model = XGBRegressor(
        objective="reg:squarederror",
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        learning_rate=args.learning_rate,
        subsample=args.subsample,
        colsample_bytree=args.colsample_bytree,
        random_state=args.seed,
        n_jobs=args.n_jobs,
        eval_metric="rmse",
        missing=np.nan,
    )

    model.fit(x[train_indices], y[train_indices])

    train_predictions = model.predict(x[train_indices])
    holdout_predictions = model.predict(x[holdout_indices]) if len(holdout_indices) else np.array([])
    all_predictions = model.predict(x)

    args.model_output.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(args.model_output)

    metadata = {
        "model_type": "xgboost.XGBRegressor",
        "model_path": relative_to_repo(args.model_output),
        "target_column": args.target,
        "feature_columns": feature_columns,
        "training_input": relative_to_repo(args.input),
        "training_rows": int(len(y)),
        "train_rows": int(len(train_indices)),
        "holdout_rows": int(len(holdout_indices)),
        "row_ids": row_ids,
        "target": {
            "min": safe_float(np.min(y)),
            "max": safe_float(np.max(y)),
            "mean": safe_float(np.mean(y)),
            "distinct_values": distinct_targets,
        },
        "metrics": {
            "train_mae": mae(y[train_indices], train_predictions, np),
            "train_rmse": rmse(y[train_indices], train_predictions, np),
            "holdout_mae": mae(y[holdout_indices], holdout_predictions, np) if len(holdout_indices) else None,
            "holdout_rmse": rmse(y[holdout_indices], holdout_predictions, np) if len(holdout_indices) else None,
        },
        "hyperparameters": {
            "n_estimators": args.n_estimators,
            "max_depth": args.max_depth,
            "learning_rate": args.learning_rate,
            "subsample": args.subsample,
            "colsample_bytree": args.colsample_bytree,
            "seed": args.seed,
            "n_jobs": args.n_jobs,
        },
        "xgboost_version": xgboost.__version__,
        "sklearn_version": sklearn.__version__,
        "constant_target_warning": len(distinct_targets) == 1,
    }

    args.metadata_output.parent.mkdir(parents=True, exist_ok=True)
    args.metadata_output.write_text(f"{json.dumps(metadata, indent=2)}\n", encoding="utf-8")
    write_feature_importance(args.importance_output, feature_columns, model.feature_importances_)

    print(f"Trained on {len(y)} labeled rows using {len(feature_columns)} features.")
    print(f"Model: {args.model_output}")
    print(f"Metadata: {args.metadata_output}")
    print(f"Feature importance: {args.importance_output}")
    print(
        "Training MAE/RMSE: "
        f"{metadata['metrics']['train_mae']:.6f} / {metadata['metrics']['train_rmse']:.6f}"
    )
    if len(holdout_indices):
        print(
            "Holdout MAE/RMSE: "
            f"{metadata['metrics']['holdout_mae']:.6f} / {metadata['metrics']['holdout_rmse']:.6f}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the Zip puzzle XGBoost quality model.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Joined training CSV.")
    parser.add_argument("--target", default="enjoyment_score", help="Numeric target column.")
    parser.add_argument("--model-output", type=Path, default=DEFAULT_MODEL_OUTPUT, help="Output model path.")
    parser.add_argument(
        "--metadata-output",
        type=Path,
        default=DEFAULT_METADATA_OUTPUT,
        help="Output JSON metadata path.",
    )
    parser.add_argument(
        "--importance-output",
        type=Path,
        default=DEFAULT_IMPORTANCE_OUTPUT,
        help="Output feature-importance CSV path.",
    )
    parser.add_argument("--min-rows", type=int, default=3, help="Minimum labeled rows required.")
    parser.add_argument("--holdout-fraction", type=float, default=0.2, help="Held-out evaluation fraction.")
    parser.add_argument("--n-estimators", type=int, default=80)
    parser.add_argument("--max-depth", type=int, default=3)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--subsample", type=float, default=0.9)
    parser.add_argument("--colsample-bytree", type=float, default=0.9)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--n-jobs", type=int, default=1)
    return parser.parse_args()


def read_csv(file_path: Path) -> list[dict[str, str]]:
    with file_path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def choose_feature_columns(rows: list[dict[str, str]], target: str) -> list[str]:
    if not rows:
        raise SystemExit("Training CSV is empty.")

    columns = rows[0].keys()
    features = []
    for column in columns:
        if column == target or column in EXCLUDED_COLUMNS:
            continue
        if column in REQUIRED_FEATURE_COLUMNS or any(is_float(row.get(column, "")) for row in rows):
            features.append(column)

    if not features:
        raise SystemExit("No numeric feature columns found.")
    return features


def build_matrix(rows: list[dict[str, str]], feature_columns: list[str], target: str, np):
    matrix = []
    labels = []
    row_ids = []

    for index, row in enumerate(rows):
        target_value = parse_float(row.get(target, ""))
        if target_value is None:
            continue

        matrix.append([parse_float(row.get(column, "")) for column in feature_columns])
        labels.append(target_value)
        row_ids.append(row.get("puzzle_id") or row.get("id") or str(index))

    if not labels:
        raise SystemExit(f"No labeled rows found in target column '{target}'.")

    return np.array(matrix, dtype=float), np.array(labels, dtype=float), row_ids


def split_indices(count: int, holdout_fraction: float, seed: int, np):
    indices = np.arange(count)
    if count < 8 or holdout_fraction <= 0:
        return indices, np.array([], dtype=int)

    rng = np.random.default_rng(seed)
    rng.shuffle(indices)
    holdout_count = max(1, min(count - 1, round(count * holdout_fraction)))
    return indices[holdout_count:], indices[:holdout_count]


def write_feature_importance(output: Path, feature_columns: list[str], importances: Iterable[float]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted(zip(feature_columns, importances), key=lambda item: item[1], reverse=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["feature", "importance"])
        for feature, importance in rows:
            writer.writerow([feature, f"{float(importance):.12g}"])


def parse_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    if math.isnan(parsed):
        return None
    return parsed


def is_float(value: str | None) -> bool:
    return parse_float(value) is not None


def mae(actual, predicted, np) -> float:
    return safe_float(np.mean(np.abs(actual - predicted)))


def rmse(actual, predicted, np) -> float:
    return safe_float(np.sqrt(np.mean((actual - predicted) ** 2)))


def safe_float(value) -> float:
    return float(value)


def relative_to_repo(file_path: Path) -> str:
    try:
        return str(file_path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(file_path)


if __name__ == "__main__":
    main()
