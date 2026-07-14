#!/bin/bash

# Solana Dev Skill Installer
# Installs the skill for any agent with native Agent Skills (SKILL.md) support:
# Claude Code, OpenAI Codex, GitHub Copilot, Gemini CLI, Cursor, Windsurf,
# Cline, OpenCode, and anything else that reads .agents/skills or .claude/skills.
#
# Usage: ./install.sh [--project | --path <path>] [--link]
#
# Tip: you can also install with the skills.sh CLI instead:
#   npx skills add solana-foundation/solana-dev-skill

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="solana-dev"
SOURCE_DIR="$SCRIPT_DIR/skills/$SKILL_NAME"

SCOPE="user"
CUSTOM_PATH=""
LINK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --project)
            SCOPE="project"
            shift
            ;;
        --path)
            SCOPE="custom"
            CUSTOM_PATH="$2"
            shift 2
            ;;
        --link)
            LINK=true
            shift
            ;;
        -h|--help)
            echo "Solana Dev Skill Installer"
            echo ""
            echo "Usage: ./install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project     Install into the current project (.agents/skills + .claude/skills)"
            echo "  --path PATH   Install to a single custom path"
            echo "  --link        Symlink instead of copying (one canonical copy, auto-updates with git pull)"
            echo "  -h, --help    Show this help message"
            echo ""
            echo "Default: install for the current user:"
            echo "  ~/.agents/skills/$SKILL_NAME   (Codex, Copilot, Gemini CLI, Cursor, Windsurf, OpenCode, ...)"
            echo "  ~/.claude/skills/$SKILL_NAME   (Claude Code, Cline, and compat readers)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check source
if [ ! -f "$SOURCE_DIR/SKILL.md" ]; then
    echo "Error: SKILL.md not found in '$SOURCE_DIR'"
    exit 1
fi

# Resolve target directories
case $SCOPE in
    user)
        TARGETS=("$HOME/.agents/skills/$SKILL_NAME" "$HOME/.claude/skills/$SKILL_NAME")
        ;;
    project)
        TARGETS=(".agents/skills/$SKILL_NAME" ".claude/skills/$SKILL_NAME")
        ;;
    custom)
        TARGETS=("$CUSTOM_PATH")
        ;;
esac

install_to() {
    local dest="$1"
    mkdir -p "$(dirname "$dest")"

    if [ -e "$dest" ] || [ -L "$dest" ]; then
        if [ -t 0 ]; then
            echo "Warning: '$dest' already exists"
            # /dev/tty + fallback: never aborts under set -e when stdin closes
            read -p "Overwrite? (y/N) " -n 1 -r </dev/tty 2>/dev/null || REPLY=""
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Skipped $dest"
                return
            fi
        else
            # Non-interactive (piped/CI): reinstall over the existing copy
            echo "'$dest' already exists — overwriting (non-interactive)"
        fi
        rm -rf "$dest"
    fi

    if [ "$LINK" = true ]; then
        ln -s "$SOURCE_DIR" "$dest"
        echo "Linked:    $dest -> $SOURCE_DIR"
    else
        cp -r "$SOURCE_DIR" "$dest"
        echo "Installed: $dest"
    fi
}

echo "Installing Solana Dev Skill ($SKILL_NAME)..."
echo ""
for target in "${TARGETS[@]}"; do
    install_to "$target"
done

echo ""
if [ "$SCOPE" = "custom" ]; then
    echo "Done. Make sure '$CUSTOM_PATH' is a directory your agent scans for skills."
else
    echo "Done. Agents that read these directories will pick up the skill automatically:"
    echo "  .agents/skills  -> Codex, Copilot, Gemini CLI, Cursor, Windsurf, OpenCode, and more"
    echo "  .claude/skills  -> Claude Code, Cline, and compat readers"
fi
echo ""
echo "Try asking your agent about Solana development to activate it."
