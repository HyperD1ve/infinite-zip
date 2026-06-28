---
name: clean-ds-stores
description: Clean macOS .DS_Store files from the repo working tree, run a reusable cleanup script, or install a pre-commit hook to remove .DS_Store junk files before commits.
---

# Clean .DS_Store Files

Use this skill when `.DS_Store` files appear, before committing, or when the user asks to clean macOS metadata/junk files.

Run the script from the repository root:

```sh
sh .agents/skills/clean-ds-stores/scripts/clean-ds-stores.sh
```

Useful modes:

```sh
sh .agents/skills/clean-ds-stores/scripts/clean-ds-stores.sh --check
sh .agents/skills/clean-ds-stores/scripts/clean-ds-stores.sh --install-hook
```

Prefer this script instead of manually searching for and deleting `.DS_Store` files.
