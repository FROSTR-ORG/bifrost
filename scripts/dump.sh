#!/usr/bin/env bash

# dump.sh - Export source code for code agent consumption
# A generic, flag-based source code dump script that works across project types

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
OUTPUT_FILE="./codebase.dump"

# Flags (defaults)
INCLUDE_DOCS=false
INCLUDE_TESTS=false
INCLUDE_CONFIG=false
INCLUDE_GIT=false

# Detected project type
PROJECT_TYPE=""

# Stats tracking
TOTAL_FILES=0
TOTAL_LINES=0

# =============================================================================
# FUNCTIONS
# =============================================================================

show_help() {
    cat << 'EOF'
dump.sh - Export source code for code agent consumption

USAGE:
    ./dump.sh [OPTIONS]

OPTIONS:
    -o, --output FILE   Output file path (default: ./codebase.dump)
    -d, --docs          Include documentation (docs/*.md)
    -t, --tests         Include test files
    -c, --config        Include config files (tsconfig.json, rollup.config.*, etc.)
    -g, --git           Include git metadata (branch, commit, status)
    -a, --all           Include everything (docs + tests + config + git)
    -h, --help          Show this help message

EXAMPLES:
    ./dump.sh                    # Default: manifest + README + CLAUDE.md + src/
    ./dump.sh --docs --tests     # Include docs and tests
    ./dump.sh --all -o full.dump # Everything, custom output file
    ./dump.sh -dt                # Short form: docs + tests

PROJECT TYPE DETECTION:
    Auto-detects by checking for manifest files:
    - package.json    → Node/TypeScript
    - Cargo.toml      → Rust
    - pyproject.toml  → Python
    - go.mod          → Go
EOF
}

# Detect project type based on manifest files
detect_project_type() {
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        PROJECT_TYPE="node"
    elif [[ -f "$PROJECT_ROOT/Cargo.toml" ]]; then
        PROJECT_TYPE="rust"
    elif [[ -f "$PROJECT_ROOT/pyproject.toml" ]] || [[ -f "$PROJECT_ROOT/setup.py" ]]; then
        PROJECT_TYPE="python"
    elif [[ -f "$PROJECT_ROOT/go.mod" ]]; then
        PROJECT_TYPE="go"
    else
        PROJECT_TYPE="unknown"
    fi
}

# Get manifest file for project type
get_manifest_file() {
    case "$PROJECT_TYPE" in
        node)   echo "package.json" ;;
        rust)   echo "Cargo.toml" ;;
        python) [[ -f "$PROJECT_ROOT/pyproject.toml" ]] && echo "pyproject.toml" || echo "setup.py" ;;
        go)     echo "go.mod" ;;
        *)      echo "" ;;
    esac
}

# Get source file patterns for project type
get_source_patterns() {
    case "$PROJECT_TYPE" in
        node)   echo "*.ts *.js *.tsx *.jsx" ;;
        rust)   echo "*.rs" ;;
        python) echo "*.py" ;;
        go)     echo "*.go" ;;
        *)      echo "*.ts *.js *.py *.rs *.go" ;;
    esac
}

# Get source directories for project type
get_source_dirs() {
    case "$PROJECT_TYPE" in
        node)   echo "src" ;;
        rust)   echo "src" ;;
        python) [[ -d "$PROJECT_ROOT/src" ]] && echo "src" || echo "." ;;
        go)     echo "." ;;
        *)      echo "src" ;;
    esac
}

# Get test patterns/directories for project type
get_test_patterns() {
    case "$PROJECT_TYPE" in
        node)   echo "test tests spec __tests__" ;;
        rust)   echo "tests" ;;
        python) echo "test tests" ;;
        go)     echo "*_test.go" ;;
        *)      echo "test tests" ;;
    esac
}

# Get config files for project type
get_config_files() {
    local configs=""

    case "$PROJECT_TYPE" in
        node)
            configs="tsconfig.json tsconfig.*.json rollup.config.* webpack.config.* vite.config.* jest.config.* .eslintrc* .prettierrc* babel.config.*"
            ;;
        rust)
            configs="Cargo.lock rust-toolchain.toml .cargo/config.toml"
            ;;
        python)
            configs="pyproject.toml setup.cfg requirements*.txt tox.ini .flake8 mypy.ini"
            ;;
        go)
            configs="go.sum"
            ;;
    esac

    echo "$configs"
}

# Check if file is binary (contains null bytes)
is_binary() {
    local file="$1"
    if [[ ! -f "$file" ]] || [[ ! -r "$file" ]]; then
        return 0  # Treat unreadable as binary (skip)
    fi
    # Use file command if available, otherwise check for null bytes
    if command -v file &>/dev/null; then
        local filetype
        filetype=$(file -b --mime-encoding "$file" 2>/dev/null)
        [[ "$filetype" == "binary" ]] && return 0
        return 1
    else
        # Fallback: check first 8KB for null bytes using LC_ALL=C
        LC_ALL=C head -c 8192 "$file" 2>/dev/null | LC_ALL=C grep -q '[^[:print:][:space:]]' && return 0
        return 1
    fi
}

# Get language hint from file extension
get_language() {
    local file="$1"
    local ext="${file##*.}"

    case "$ext" in
        ts|tsx)     echo "typescript" ;;
        js|jsx)     echo "javascript" ;;
        rs)         echo "rust" ;;
        py)         echo "python" ;;
        go)         echo "go" ;;
        json)       echo "json" ;;
        toml)       echo "toml" ;;
        yaml|yml)   echo "yaml" ;;
        md)         echo "markdown" ;;
        sh|bash)    echo "bash" ;;
        *)          echo "" ;;
    esac
}

# Dump a single file with header
dump_file() {
    local file="$1"
    local relative_path="${file#$PROJECT_ROOT/}"

    # Skip binary files
    if is_binary "$file"; then
        echo "# Skipping binary file: $relative_path" >&2
        return 0
    fi

    local line_count
    line_count=$(wc -l < "$file" 2>/dev/null || echo "0")
    TOTAL_LINES=$((TOTAL_LINES + line_count))
    TOTAL_FILES=$((TOTAL_FILES + 1))

    echo ""
    echo "================================================================================"
    echo "FILE: $relative_path"
    echo "================================================================================"
    echo ""
    cat "$file" 2>/dev/null || echo "# Error reading file"
    echo ""
}

# Collect files matching patterns in a directory
collect_files() {
    local dir="$1"
    shift
    local patterns=("$@")

    if [[ ! -d "$dir" ]]; then
        return 0
    fi

    for pattern in "${patterns[@]}"; do
        find "$dir" -name "$pattern" -type f 2>/dev/null || true
    done | sort -u
}

# =============================================================================
# ARGUMENT PARSING
# =============================================================================

while [[ $# -gt 0 ]]; do
    case "$1" in
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -d|--docs)
            INCLUDE_DOCS=true
            shift
            ;;
        -t|--tests)
            INCLUDE_TESTS=true
            shift
            ;;
        -c|--config)
            INCLUDE_CONFIG=true
            shift
            ;;
        -g|--git)
            INCLUDE_GIT=true
            shift
            ;;
        -a|--all)
            INCLUDE_DOCS=true
            INCLUDE_TESTS=true
            INCLUDE_CONFIG=true
            INCLUDE_GIT=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            # Handle combined short flags like -dt
            flags="${1#-}"
            shift
            for (( i=0; i<${#flags}; i++ )); do
                flag="${flags:$i:1}"
                case "$flag" in
                    o) OUTPUT_FILE="$1"; shift ;;
                    d) INCLUDE_DOCS=true ;;
                    t) INCLUDE_TESTS=true ;;
                    c) INCLUDE_CONFIG=true ;;
                    g) INCLUDE_GIT=true ;;
                    a) INCLUDE_DOCS=true; INCLUDE_TESTS=true; INCLUDE_CONFIG=true; INCLUDE_GIT=true ;;
                    h) show_help; exit 0 ;;
                    *) echo "Unknown flag: -$flag" >&2; exit 1 ;;
                esac
            done
            ;;
        *)
            echo "Unknown argument: $1" >&2
            show_help
            exit 1
            ;;
    esac
done

# =============================================================================
# MAIN
# =============================================================================

detect_project_type

echo "Dumping project to $OUTPUT_FILE..." >&2
echo "  Project type: $PROJECT_TYPE" >&2
echo "  Options: docs=$INCLUDE_DOCS tests=$INCLUDE_TESTS config=$INCLUDE_CONFIG git=$INCLUDE_GIT" >&2

{
    # Header
    echo "================================================================================"
    echo "PROJECT DUMP: $PROJECT_NAME"
    echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "================================================================================"
    echo ""

    # Git info (if requested)
    if [[ "$INCLUDE_GIT" == true ]] && command -v git &>/dev/null && [[ -d "$PROJECT_ROOT/.git" ]]; then
        echo "[GIT]"
        branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")
        commit=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")

        # Count modified and untracked
        modified=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null | grep -c "^ M\|^M " || echo "0")
        untracked=$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null | grep -c "^??" || echo "0")

        echo "Branch: $branch | Commit: $commit | Status: $modified modified, $untracked untracked"
        echo ""
    fi

    # Build table of contents
    echo "[TABLE OF CONTENTS]"

    section_num=0
    toc_entries=()

    # Section: Project Documentation (always included)
    section_num=$((section_num + 1))
    echo "Section $section_num: Project Documentation"
    manifest=$(get_manifest_file)
    [[ -n "$manifest" && -f "$PROJECT_ROOT/$manifest" ]] && echo "  - $manifest"
    [[ -f "$PROJECT_ROOT/CLAUDE.md" ]] && echo "  - CLAUDE.md"
    [[ -f "$PROJECT_ROOT/.claude/instructions.md" ]] && echo "  - .claude/instructions.md"
    [[ -f "$PROJECT_ROOT/README.md" ]] && echo "  - README.md"

    # Section: Documentation (if --docs)
    if [[ "$INCLUDE_DOCS" == true ]] && [[ -d "$PROJECT_ROOT/docs" ]]; then
        section_num=$((section_num + 1))
        echo "Section $section_num: Documentation"
        find "$PROJECT_ROOT/docs" -name "*.md" -type f 2>/dev/null | sort | while read -r f; do
            echo "  - ${f#$PROJECT_ROOT/}"
        done
    fi

    # Section: Configuration (if --config)
    if [[ "$INCLUDE_CONFIG" == true ]]; then
        section_num=$((section_num + 1))
        echo "Section $section_num: Configuration"
        for pattern in $(get_config_files); do
            for f in "$PROJECT_ROOT"/$pattern; do
                [[ -f "$f" ]] && echo "  - ${f#$PROJECT_ROOT/}"
            done 2>/dev/null || true
        done
    fi

    # Section: Source Files (always included)
    section_num=$((section_num + 1))
    echo "Section $section_num: Source Files"
    src_dir=$(get_source_dirs)
    read -ra patterns <<< "$(get_source_patterns)"
    if [[ -d "$PROJECT_ROOT/$src_dir" ]]; then
        collect_files "$PROJECT_ROOT/$src_dir" "${patterns[@]}" | while read -r f; do
            echo "  - ${f#$PROJECT_ROOT/}"
        done
    fi

    # Section: Tests (if --tests)
    if [[ "$INCLUDE_TESTS" == true ]]; then
        section_num=$((section_num + 1))
        echo "Section $section_num: Test Files"
        for test_dir in $(get_test_patterns); do
            if [[ -d "$PROJECT_ROOT/$test_dir" ]]; then
                read -ra patterns <<< "$(get_source_patterns)"
                collect_files "$PROJECT_ROOT/$test_dir" "${patterns[@]}" | while read -r f; do
                    echo "  - ${f#$PROJECT_ROOT/}"
                done
            fi
        done
    fi

    echo ""

    # ==========================================================================
    # SECTION: Project Documentation
    # ==========================================================================

    section_num=0
    section_num=$((section_num + 1))

    echo "================================================================================"
    echo "SECTION $section_num: PROJECT DOCUMENTATION"
    echo "================================================================================"

    manifest=$(get_manifest_file)
    [[ -n "$manifest" && -f "$PROJECT_ROOT/$manifest" ]] && dump_file "$PROJECT_ROOT/$manifest"
    [[ -f "$PROJECT_ROOT/CLAUDE.md" ]] && dump_file "$PROJECT_ROOT/CLAUDE.md"
    [[ -f "$PROJECT_ROOT/.claude/instructions.md" ]] && dump_file "$PROJECT_ROOT/.claude/instructions.md"
    [[ -f "$PROJECT_ROOT/README.md" ]] && dump_file "$PROJECT_ROOT/README.md"

    # ==========================================================================
    # SECTION: Documentation (if --docs)
    # ==========================================================================

    if [[ "$INCLUDE_DOCS" == true ]] && [[ -d "$PROJECT_ROOT/docs" ]]; then
        section_num=$((section_num + 1))
        echo ""
        echo "================================================================================"
        echo "SECTION $section_num: DOCUMENTATION"
        echo "================================================================================"

        find "$PROJECT_ROOT/docs" -name "*.md" -type f 2>/dev/null | sort | while read -r file; do
            dump_file "$file"
        done
    fi

    # ==========================================================================
    # SECTION: Configuration (if --config)
    # ==========================================================================

    if [[ "$INCLUDE_CONFIG" == true ]]; then
        section_num=$((section_num + 1))
        echo ""
        echo "================================================================================"
        echo "SECTION $section_num: CONFIGURATION"
        echo "================================================================================"

        for pattern in $(get_config_files); do
            for file in "$PROJECT_ROOT"/$pattern; do
                [[ -f "$file" ]] && dump_file "$file"
            done 2>/dev/null || true
        done
    fi

    # ==========================================================================
    # SECTION: Source Files
    # ==========================================================================

    section_num=$((section_num + 1))
    echo ""
    echo "================================================================================"
    echo "SECTION $section_num: SOURCE FILES"
    echo "================================================================================"

    src_dir=$(get_source_dirs)
    read -ra patterns <<< "$(get_source_patterns)"
    if [[ -d "$PROJECT_ROOT/$src_dir" ]]; then
        collect_files "$PROJECT_ROOT/$src_dir" "${patterns[@]}" | while read -r file; do
            dump_file "$file"
        done
    fi

    # ==========================================================================
    # SECTION: Tests (if --tests)
    # ==========================================================================

    if [[ "$INCLUDE_TESTS" == true ]]; then
        section_num=$((section_num + 1))
        echo ""
        echo "================================================================================"
        echo "SECTION $section_num: TEST FILES"
        echo "================================================================================"

        for test_dir in $(get_test_patterns); do
            if [[ -d "$PROJECT_ROOT/$test_dir" ]]; then
                read -ra patterns <<< "$(get_source_patterns)"
                collect_files "$PROJECT_ROOT/$test_dir" "${patterns[@]}" | while read -r file; do
                    dump_file "$file"
                done
            fi
        done
    fi

} > "$OUTPUT_FILE"

# Calculate final stats
file_count=$(grep -c "^FILE: " "$OUTPUT_FILE" 2>/dev/null || echo "0")
line_count=$(wc -l < "$OUTPUT_FILE" 2>/dev/null || echo "0")
size=$(du -h "$OUTPUT_FILE" 2>/dev/null | cut -f1 || echo "?")

# Append stats to file
{
    echo ""
    echo "================================================================================"
    echo "STATS: $file_count files | $line_count lines | $size"
    echo "================================================================================"
} >> "$OUTPUT_FILE"

echo "" >&2
echo "Created: $OUTPUT_FILE" >&2
echo "Stats: $file_count files | $line_count lines | $size" >&2
