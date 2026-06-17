#!/usr/bin/env python3
"""Score generated Zip puzzle feature rows with the trained XGBoost model."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_METADATA = REPO_ROOT / "models" / "puzzle_quality-metadata.json"


def main() -> None:
    args = parse_args()

    try:
        import numpy as np
        from xgboost import XGBRegressor
    except ModuleNotFoundError as error:
        missing = error.name or "xgboost"
        raise SystemExit(
            f"Missing Python package '{missing}'. Install local ML dependencies with:\n"
            "  python3 -m pip install -r requirements-ml.txt"
        ) from error

    metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
    model_path = args.model or REPO_ROOT / metadata["model_path"]
    feature_columns = metadata["feature_columns"]
    rows = json.load(sys.stdin)

    if not isinstance(rows, list):
        raise SystemExit("Expected stdin to contain a JSON array of feature rows.")

    matrix = np.array([
        [parse_float(row.get(column)) for column in feature_columns]
        for row in rows
    ], dtype=float)

    model = XGBRegressor()
    model.load_model(model_path)
    predictions = model.predict(matrix)

    json.dump([
        {
            "scorer_name": "xgboost_model_v0",
            "predicted_quality_score": safe_float(score),
            "ranking_score": safe_float(score),
        }
        for score in predictions
    ], sys.stdout)
    sys.stdout.write("\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict Zip puzzle quality from feature rows.")
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA, help="Model metadata JSON.")
    parser.add_argument("--model", type=Path, default=None, help="Override model artifact path.")
    return parser.parse_args()


def parse_float(value) -> float:
    if value is None or value == "":
        return math.nan
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return math.nan
    return parsed if math.isfinite(parsed) else math.nan


def safe_float(value) -> float:
    parsed = float(value)
    return parsed if math.isfinite(parsed) else 0.0


if __name__ == "__main__":
    main()
