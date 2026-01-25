# Release Process

This document describes the release workflow for Bifrost.

---

## Overview

Bifrost follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (`X.0.0`): Breaking API changes
- **MINOR** (`0.X.0`): New features, backward compatible
- **PATCH** (`0.0.X`): Bug fixes, backward compatible

### Branch Strategy

| Branch | Purpose | Version Tag |
|--------|---------|-------------|
| `master` | Official releases | `vX.Y.Z` |
| `dev` | Development releases | `vX.Y.Z-dev` |

---

## Pre-Release Checklist

Before releasing, run the full package pipeline:

```bash
./scripts/package.sh
```

This script runs:
1. **Lint** (`npm run lint`) - Biome code quality checks
2. **Type Check** (`npm run check`) - TypeScript validation
3. **Test** (`npm run test`) - Full test suite (unit + e2e + integration)
4. **Build** (`npm run build`) - TypeScript compilation + Rollup bundling

### Manual Verification

```bash
# Run individually if needed
npm run lint          # Fix: npx biome check src/ --write
npm run check         # Fix: Address TypeScript errors
npm test              # All 716+ tests should pass
npm run build         # Verify dist/ is generated
```

---

## Release Workflow

### 1. Update Version

Edit `package.json`:

```json
{
  "version": "2.1.0"
}
```

**Version Guidelines:**
- Bump MAJOR for breaking changes (API signature changes, removed features)
- Bump MINOR for new features (new methods, new options)
- Bump PATCH for bug fixes (no API changes)

### 2. Update CHANGELOG

Document changes in `CHANGELOG.md`:

```markdown
## [2.1.0] - 2025-01-24

### Added
- New `sign_batch` API for batch signing operations
- Debug logging with namespace support

### Changed
- Improved error messages with context preservation

### Fixed
- Timing-dependent cache test reliability
```

### 3. Commit Changes

```bash
git add package.json CHANGELOG.md
git commit -m "release: v2.1.0"
```

### 4. Create Release Tag

For official releases (from `master`):

```bash
./scripts/release.sh
```

This script:
- Reads version from `package.json`
- Checks if tag already exists
- Creates and pushes tag `vX.Y.Z`

For development releases (from `dev`):

```bash
# Manual tagging with -dev suffix
git tag v2.1.0-dev
git push origin v2.1.0-dev
```

### 5. Publish to npm

```bash
npm publish
```

For scoped packages (@frostr/bifrost):
```bash
npm publish --access public
```

### 6. Create GitHub Release

1. Go to [Releases](https://github.com/FROSTR-ORG/bifrost/releases)
2. Click "Draft a new release"
3. Select the tag you just created
4. Title: `v2.1.0`
5. Description: Copy from CHANGELOG.md
6. Publish release

---

## Development Releases

For pre-release testing:

```bash
# 1. Update version with -dev suffix
npm version 2.1.0-dev --no-git-tag-version

# 2. Publish with dev tag
npm publish --tag dev

# Users install with:
npm install @frostr/bifrost@dev
```

---

## Hotfix Process

For urgent fixes to production:

```bash
# 1. Create hotfix branch from master
git checkout master
git checkout -b hotfix/critical-fix

# 2. Make fix, test, commit
npm test
git commit -m "fix: critical security issue"

# 3. Merge to master and tag
git checkout master
git merge hotfix/critical-fix
npm version patch  # Bumps 2.1.0 → 2.1.1
./scripts/release.sh

# 4. Merge back to dev
git checkout dev
git merge master
```

---

## Quick Reference

### Commands

| Task | Command |
|------|---------|
| Full package check | `./scripts/package.sh` |
| Create release tag | `./scripts/release.sh` |
| Publish to npm | `npm publish --access public` |
| Publish dev release | `npm publish --tag dev` |

### Version Examples

| Change | Before | After |
|--------|--------|-------|
| Breaking API change | 2.0.1 | 3.0.0 |
| New feature | 2.0.1 | 2.1.0 |
| Bug fix | 2.0.1 | 2.0.2 |
| Dev release | 2.0.1 | 2.1.0-dev |

### Release Checklist

- [ ] All tests pass (`npm test`)
- [ ] No lint errors (`npm run lint`)
- [ ] No type errors (`npm run check`)
- [ ] Build succeeds (`npm run build`)
- [ ] Version bumped in `package.json`
- [ ] CHANGELOG.md updated
- [ ] Changes committed
- [ ] Tag created and pushed
- [ ] npm published
- [ ] GitHub release created

---

## Troubleshooting

### Tag Already Exists

```bash
# Delete local tag
git tag -d v2.1.0

# Delete remote tag (use with caution)
git push origin :refs/tags/v2.1.0
```

### npm Publish Fails

```bash
# Check you're logged in
npm whoami

# Login if needed
npm login

# Verify package access
npm access ls-packages
```

### Build Issues

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```
