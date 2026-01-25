# WORKTREE.md: Guide for Agents Using Git Worktrees

This guide outlines the process for agents to work in isolated git worktrees, implement changes, and merge back to the main branch. Worktrees allow parallel development without branch switching, keeping the main repo clean while you work.

## Prerequisites

- Familiarity with git basics (commit, push, merge)
- Access to the main repository
- Understanding of the project's branching strategy (e.g., `main`, `dev`)

## 1. Check Existing Worktrees

Before creating a new worktree, check what already exists:

```bash
git worktree list
```

This shows all active worktrees and their associated branches.

## 2. Create a Worktree

From the main repository:

```bash
# Create feature branch and worktree in one command
git worktree add /path/to/worktree-name feature/branch-name

# Or base it on a specific branch (e.g., dev instead of HEAD)
git worktree add /path/to/worktree-name -b feature/branch-name dev
```

**Naming conventions:**
- Use descriptive paths that indicate purpose: `/path/to/project-api-refactor`
- Branch names should match: `feature/api-refactor`

**If the branch already exists:**
```bash
git worktree add /path/to/worktree-name existing-branch-name
```

## 3. Set Up the Worktree Environment

Navigate to the worktree and install dependencies:

```bash
cd /path/to/worktree-name

# Install project dependencies (see Ecosystem Reference below)
```

Verify the setup by running the project's test suite or build command.

## 4. Implement Your Changes

Work within the worktree as you would in any git repository:

```bash
# Make changes to files
# ...

# Stage specific files (avoid `git add .` to prevent accidental commits)
git add src/module.ext src/other.ext

# Commit with descriptive messages
git commit -m "feat(scope): description of change"

# Push to remote (optional, for backup or collaboration)
git push -u origin feature/branch-name
```

**Best practices:**
- Commit frequently with focused, atomic changes
- Run tests before committing
- Stay focused on the assigned task—avoid unrelated changes

## 5. Prepare for Merge

Before merging, sync with the target branch to catch conflicts early:

```bash
# In your worktree
git fetch origin
git merge origin/dev  # or origin/main, depending on your target

# Resolve any conflicts (see Section 8)
# Re-run tests to verify nothing broke

# Commit the merge resolution if there were conflicts
```

## 6. Merge Back to Target Branch

### Option A: Merge from Main Repository

```bash
# Switch to main repository
cd /path/to/main-repo

# Stash any uncommitted changes (if present)
git stash

# Ensure target branch is up to date
git checkout dev
git pull origin dev

# Merge the feature branch
git merge feature/branch-name -m "Merge feature/branch-name: Brief description"

# Restore stashed changes if needed
git stash pop
```

### Option B: Create a Pull Request

For projects requiring code review:

```bash
# Push your branch if not already pushed
git push -u origin feature/branch-name

# Create PR via GitHub CLI
gh pr create --base dev --head feature/branch-name --title "Feature: Description" --body "Details..."
```

## 7. Clean Up

After successful merge:

```bash
# Remove the worktree (use --force if it contains untracked files)
git worktree remove /path/to/worktree-name --force

# Delete the local branch
git branch -d feature/branch-name

# Delete the remote branch (if applicable)
git push origin --delete feature/branch-name
```

## 8. Handling Merge Conflicts

Git marks conflicts in files with conflict markers:

```
<<<<<<< HEAD
// Code from target branch (ours)
=======
// Code from feature branch (theirs)
>>>>>>> feature/branch-name
```

**Resolution process:**

1. Open the conflicted file
2. Understand both versions—don't blindly pick one
3. Combine the changes logically, removing all conflict markers
4. Stage the resolved file: `git add resolved-file.ext`
5. Continue the merge: `git merge --continue`
6. Re-run tests to verify the resolution

**When to escalate:**
- Conflicts in unfamiliar code
- Architectural disagreements between branches
- Uncertainty about intended behavior

Do not force through unreviewed conflict resolutions.

## 9. Troubleshooting

### Worktree removal fails
```bash
# Untracked files (dependencies, build artifacts) block removal
git worktree remove /path/to/worktree --force
```

### Branch already checked out in another worktree
```bash
# Check which worktree has the branch
git worktree list

# Remove the other worktree first, or use a different branch name
```

### Merge blocked by uncommitted changes in main repo
```bash
git stash
git merge feature/branch-name
git stash pop  # Restore changes after merge
```

### Worktree path already exists
```bash
# Remove the directory if it's stale
rm -rf /path/to/worktree
git worktree prune  # Clean up worktree metadata
git worktree add /path/to/worktree feature/branch-name
```

### Dependencies not installed
Worktrees share git history but not installed dependencies. Always run the appropriate install command after creating a worktree.

## Best Practices Summary

1. **Isolation**: Each worktree = one task. Avoid mixing unrelated changes.
2. **Naming**: Use descriptive worktree paths and branch names.
3. **Testing**: Run tests before commits and after merges.
4. **Staging**: Add specific files, not `git add .` or `git add -A`.
5. **Cleanup**: Remove worktrees promptly after merging to avoid clutter.
6. **Communication**: Document what you're working on to avoid overlapping tasks with other agents.

## Quick Reference

```bash
# List worktrees
git worktree list

# Create worktree with new branch
git worktree add /path/to/worktree -b feature/name base-branch

# Create worktree with existing branch
git worktree add /path/to/worktree existing-branch

# Remove worktree
git worktree remove /path/to/worktree --force

# Clean stale worktree references
git worktree prune
```

## Ecosystem Reference

Common commands for dependency installation and testing:

| Ecosystem | Install Dependencies | Run Tests |
|-----------|---------------------|-----------|
| Node.js | `npm install` | `npm test` |
| Node.js (yarn) | `yarn install` | `yarn test` |
| Node.js (pnpm) | `pnpm install` | `pnpm test` |
| Python | `pip install -r requirements.txt` | `pytest` |
| Python (poetry) | `poetry install` | `poetry run pytest` |
| Rust | `cargo build` | `cargo test` |
| Go | `go mod download` | `go test ./...` |
| Ruby | `bundle install` | `bundle exec rspec` |
| Java (Maven) | `mvn install` | `mvn test` |
| Java (Gradle) | `./gradlew build` | `./gradlew test` |
| .NET | `dotnet restore` | `dotnet test` |
