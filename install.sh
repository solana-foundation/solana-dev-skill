#!/bin/bash

# Solana Dev Skill Installer for Claude Code
# Usage: ./install.sh [--project | --path <path>]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="solana-dev"

SOURCE_DIR="$SCRIPT_DIR/skills"
REFERENCES_DIR="$SCRIPT_DIR/references"

# Default to personal installation
INSTALL_PATH="$HOME/.claude/skills/$SKILL_NAME"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --project)
            INSTALL_PATH=".claude/skills/$SKILL_NAME"
            shift
            ;;
        --path)
            INSTALL_PATH="$2"
            shift 2
            ;;
        -h|--help)
            echo "Solana Dev Skill Installer"
            echo ""
            echo "Usage: ./install.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project     Install to current project (.claude/skills/$SKILL_NAME)"
            echo "  --path PATH   Install to custom path"
            echo "  -h, --help    Show this help message"
            echo ""
            echo "Default: Install to ~/.claude/skills/$SKILL_NAME"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check directories
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: skills directory not found"
    exit 1
fi

if [ ! -d "$REFERENCES_DIR" ]; then
    echo "Error: references directory not found"
    exit 1
fi

# Create parent directory
mkdir -p "$(dirname "$INSTALL_PATH")"

# Check if destination exists
if [ -d "$INSTALL_PATH" ]; then
    echo "Warning: '$INSTALL_PATH' already exists"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled"
        exit 0
    fi
    rm -rf "$INSTALL_PATH"
fi

# Install
echo "Installing Solana Dev Skills..."
mkdir -p "$INSTALL_PATH"

cp -r "$SOURCE_DIR" "$INSTALL_PATH"
cp -r "$REFERENCES_DIR" "$INSTALL_PATH"

echo ""
echo "Successfully installed to: $INSTALL_PATH"
echo ""

echo "Installed files:"
find "$INSTALL_PATH" -type f -name "*.md" | while read -r file; do
    echo "  - $(basename "$file")"
done

echo ""
echo "The skills are now available in Claude Code."
echo "Try asking about Solana development to activate them!"