---
name: process-images
description: Convert paired solved/unsolved Zip screenshots from assets/data/official-images into Zip Puzzle JSON, including clues, walls, and solution paths.
---

# Process Images

Use this skill when converting paired `*-unsolved.png` and `*-solved.png` Zip screenshots into Puzzle objects.

Run:

```sh
npm run process:images
```

Requires local ImageMagick commands `identify` and `magick`.

Default paths:

```text
input:  assets/data/official-images
output: assets/data/image-puzzles
```

Expected screenshot pair format:

```text
assets/data/official-images/11-6-unsolved.png
assets/data/official-images/11-6-solved.png
```

Read `references/conversion-details.md` when you need detection details, clue-number inference, or Puzzle JSON shape.

Prefer running or patching `scripts/convert-images.js` rather than retyping image-processing logic.
