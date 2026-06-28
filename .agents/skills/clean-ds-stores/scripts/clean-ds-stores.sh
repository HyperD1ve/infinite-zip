#!/usr/bin/env sh
set -eu

MARKER="# clean-ds-stores hook"
SCRIPT_NAME=$(basename "$0")
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_NAME"

usage() {
  cat <<'EOF'
Usage: clean-ds-stores.sh [--clean | --check | --install-hook] [path]

Modes:
  --clean         Delete .DS_Store files under the target repo/directory. Default.
  --check         Fail if .DS_Store files are present.
  --install-hook  Install a local Git pre-commit hook that runs --clean.

The optional path may be any directory inside the target project. This script is
designed to live inside a Codex skill folder and can be run from any checkout.
EOF
}

mode="clean"
target="."

while [ "$#" -gt 0 ]; do
  case "$1" in
    --clean)
      mode="clean"
      ;;
    --check)
      mode="check"
      ;;
    --install-hook)
      mode="install-hook"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      target="$1"
      ;;
  esac
  shift
done

if repo_root=$(git -C "$target" rev-parse --show-toplevel 2>/dev/null); then
  is_git_repo="true"
else
  repo_root=$(cd "$target" && pwd)
  is_git_repo="false"
fi

find_ds_stores() {
  find "$repo_root" -path "$repo_root/.git" -prune -o -type f -name .DS_Store -print
}

clean_ds_stores() {
  found_file=$(mktemp)
  find_ds_stores > "$found_file"

  if [ -s "$found_file" ]; then
    while IFS= read -r file_path; do
      rm -f "$file_path"
      printf 'removed %s\n' "$file_path"
    done < "$found_file"
  fi
  rm -f "$found_file"

  if [ "$is_git_repo" = "true" ]; then
    git -C "$repo_root" rm -f --quiet --ignore-unmatch -- .DS_Store ':(glob)**/.DS_Store' || true
  fi
}

check_ds_stores() {
  found_file=$(mktemp)
  find_ds_stores > "$found_file"

  if [ -s "$found_file" ]; then
    cat "$found_file"
    rm -f "$found_file"
    printf 'Found .DS_Store files.\n' >&2
    exit 1
  fi

  rm -f "$found_file"
}

install_hook() {
  if [ "$is_git_repo" != "true" ]; then
    printf 'Not inside a Git repository: %s\n' "$repo_root" >&2
    exit 1
  fi

  hook_dir="$repo_root/.git/hooks"
  hook_path="$hook_dir/pre-commit"
  backup_path="$hook_path.before-clean-ds-stores"
  mkdir -p "$hook_dir"

  if [ -f "$hook_path" ] && ! grep -Fq "$MARKER" "$hook_path"; then
    if [ -e "$backup_path" ]; then
      printf 'Refusing to overwrite existing backup: %s\n' "$backup_path" >&2
      exit 1
    fi
    mv "$hook_path" "$backup_path"
  fi

  cat > "$hook_path" <<EOF
#!/usr/bin/env sh
set -eu
# clean-ds-stores hook

repo_root=\$(git rev-parse --show-toplevel)
cleaner="$SCRIPT_PATH"
previous_hook="\$repo_root/.git/hooks/pre-commit.before-clean-ds-stores"

if [ -x "\$cleaner" ]; then
  "\$cleaner" --clean "\$repo_root"
else
  printf 'Missing executable cleaner: %s\n' "\$cleaner" >&2
  exit 1
fi

if [ -x "\$previous_hook" ]; then
  "\$previous_hook" "\$@"
fi
EOF

  chmod +x "$hook_path"
  printf 'Installed %s\n' "$hook_path"
}

case "$mode" in
  clean)
    clean_ds_stores
    ;;
  check)
    check_ds_stores
    ;;
  install-hook)
    install_hook
    ;;
esac
