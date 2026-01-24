#!/bin/bash

# dump.sh - Export source code and documentation for code agent consumption
# Outputs a single text file optimized for LLM/agent context

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/codebase.dump"

# Function to dump a file with a header
dump_file() {
    local file="$1"
    local relative_path="${file#$PROJECT_ROOT/}"

    echo ""
    echo "================================================================================"
    echo "FILE: $relative_path"
    echo "================================================================================"
    echo ""
    cat "$file"
    echo ""
}

# Start fresh
echo "Dumping project to $OUTPUT_FILE..."

{
    cat << 'EOF'
================================================================================
SOURCE CODE DUMP
================================================================================

This file contains all documentation and source code for the project.
Optimized for code agent consumption.

TABLE OF CONTENTS:
  1. Project Documentation (CLAUDE.md, README.md, package.json)
  2. Documentation Files (docs/)
  3. Source Files (src/)

EOF

    echo ""
    echo "================================================================================"
    echo "SECTION 1: PROJECT DOCUMENTATION"
    echo "================================================================================"

    # Core project files first
    for file in "$PROJECT_ROOT/CLAUDE.md" "$PROJECT_ROOT/README.md" "$PROJECT_ROOT/package.json"; do
        if [ -f "$file" ]; then
            dump_file "$file"
        fi
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 2: DOCUMENTATION FILES"
    echo "================================================================================"

    # Documentation files
    find "$PROJECT_ROOT/docs" -name "*.md" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

    echo ""
    echo "================================================================================"
    echo "SECTION 3: SOURCE FILES"
    echo "================================================================================"

    # All source files in src/
    find "$PROJECT_ROOT/src" -name "*.ts" -type f 2>/dev/null | sort | while read -r file; do
        dump_file "$file"
    done

} > "$OUTPUT_FILE"

echo ""
echo "Created: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo "Lines: $(wc -l < "$OUTPUT_FILE")"
