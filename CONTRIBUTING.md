# Contributing Guide

Guidelines for contributing to Bifrost.

## Getting Started

```bash
git clone https://github.com/FROSTR-ORG/bifrost.git
cd bifrost
npm install
npm test
```

## Development Workflow

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable releases |
| `dev` | Integration branch |
| `feature/*` | New features |
| `fix/*` | Bug fixes |

### Making Changes

1. Create a feature branch from `dev`
2. Make changes with tests
3. Run `npm test` to verify
4. Submit PR to `dev`

## Code Style

### TypeScript

- Strict mode enabled (`noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`)
- Use path alias `@/*` for `src/*` imports
- Prefer explicit types over inference for public APIs
- Use `snake_case` for functions and variables
- Use `PascalCase` for types and classes

### Naming Conventions

```typescript
// Functions: snake_case, verb-first
function create_session() { }
function get_peer_pubkeys() { }
function parse_error() { }

// Types: PascalCase
interface GroupPackage { }
type SignatureEntry = { }

// Constants: UPPER_SNAKE_CASE
const DEFAULT_TIMEOUT = 5000
```

### File Organization

```
src/
├── api/        # Request/response handlers
├── class/      # Core classes
├── encoder/    # Bech32 encoding
├── lib/        # Protocol functions
├── schema/     # Zod validation
├── types/      # TypeScript interfaces
└── util/       # Helpers
```

## Testing

### Running Tests

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:e2e      # E2E tests only
npm run test:int      # Integration tests only
npm run scratch       # Ad-hoc testing
```

### Writing Tests

- Place tests in `test/src/case/` organized by type (unit, e2e, integration)
- Use tape framework with async/await
- Follow existing patterns in test files

```typescript
import tape from 'tape'

tape('feature description', async t => {
  // Arrange
  const input = createTestData()

  // Act
  const result = await functionUnderTest(input)

  // Assert
  t.ok(result.ok, 'operation succeeded')
  t.equal(result.data, expected, 'correct output')
})
```

### Test Requirements

- Unit tests for new utility functions
- E2E tests for new API methods
- All tests must pass before merge

## Pull Requests

### Before Submitting

- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No unused imports or variables
- [ ] Documentation updated if needed

### PR Title Format

```
type(scope): description

Examples:
feat(api): add batch signing support
fix(pool): prevent nonce exhaustion on rapid signing
docs(guide): update demo commands
refactor(signer): simplify partial signature flow
```

### PR Description

Include:
- What changed and why
- Breaking changes (if any)
- Testing done

## Documentation

### When to Update Docs

- New public API methods → API.md
- New concepts/terms → GLOSSARY.md
- Architecture changes → ARCHITECTURE.md
- Protocol changes → PROTOCOL.md
- Breaking changes → MIGRATION.md + CHANGELOG.md

### Documentation Style

- Use terminology from GLOSSARY.md
- Reference source files as `file.ts:line`
- Keep code examples synchronized with actual API
- Add cross-references between related sections

## Security

### Reporting Vulnerabilities

Do **not** open public issues for security vulnerabilities. Email maintainers privately with:
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security-Sensitive Code

Extra review required for changes to:
- `src/lib/sign.ts` - Signing operations
- `src/lib/ecdh.ts` - Key exchange
- `src/class/pool.ts` - Nonce management
- `src/class/signer.ts` - Cryptographic operations

## Questions?

- Check existing [documentation](./INDEX.md)
- Open a GitHub issue for questions
- See [DEVELOPMENT.md](./DEVELOPMENT.md) for debugging help
