# Deployment

## Recommended Free Preview Host

Use Render for the current full-stack prototype.

This app is not only static frontend code. The local server:

- serves the browser app,
- writes feedback CSV rows,
- serves candidate batches,
- runs `npm run build:training`,
- runs Python/XGBoost training,
- runs evolutionary batch generation.

That shape fits a small long-running Node web service better than a static host or serverless-only platform.

## Render Preview

This repository includes `render.yaml`.

Deploy flow:

1. Push the repo to GitHub.
2. In Render, create a new Blueprint from the repo.
3. Use the generated `infinite-zip` web service.
4. Keep `autoDeploy` off while the app is experiment-heavy.

The service uses:

```sh
npm install && python3 -m pip install --user -r requirements-ml.txt
npm start
```

## Important Caveats

Render's free web service is good for demos and personal testing, not durable production data.

The current app writes feedback, experiment CSVs, and model artifacts to the local filesystem. On most free hosting setups, that filesystem should be treated as temporary. Before sharing this widely, move feedback and experiment output into durable storage such as:

- managed Postgres,
- SQLite on a persistent disk,
- Firebase/Supabase,
- object storage for experiment JSON/CSV files,
- or a GitHub-backed manual export workflow.

## Why Not Vercel Or Firebase Hosting First?

Vercel, Firebase Hosting, Netlify, and GitHub Pages are excellent for static frontend delivery. They are not the best first fit for this repo's current local retraining loop because `Retrain & Batch` shells out to local Node and Python scripts and writes files.

A later production split could work well:

```text
Vercel/Firebase static frontend
        +
API service for generation/training
        +
durable database/object storage
```

For now, Render is the simplest single-service deployment pattern.
