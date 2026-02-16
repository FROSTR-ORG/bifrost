# Repository Guidelines

## Project Structure & Module Organization
Core library code lives in `src/`:
- `src/api/` request handlers (`sign`, `ecdh`, `ping`, `echo`, `onboard`)
- `src/class/` runtime classes (`BifrostNode`, signer, batchers, pools)
- `src/lib/` protocol helpers
- `src/schema/` Zod validators
- `src/types/` TypeScript types
- `src/util/` shared utilities

Tests live in `test/` with split suites in `test/case/unit`, `test/case/integration`, and `test/case/e2e`. Demo code is in `demo/`. Built artifacts go to `dist/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run check`: TypeScript type-check (`tsc --noEmit`).
- `npm run lint`: run Biome lint checks on `src/`.
- `npm test`: run full test pipeline via `test/runner.ts`.
- `npm run test:unit|test:int|test:e2e`: run one suite.
- `npm run build`: compile and bundle to `dist/`.
- `npm run scratch`: run `test/scratch.ts` for ad-hoc debugging.
- `npm run demo`: launch tmux demo environment.

## Coding Style & Naming Conventions
This project uses strict TypeScript and Biome linting (`biome.json`).
- Indentation: 2 spaces, no tabs.
- Formatting style: no semicolons unless required; trailing commas in multiline blocks.
- Naming: `snake_case` for library functions/config fields, `camelCase` for class public methods, `PascalCase` for types/classes, `UPPER_SNAKE_CASE` for constants.
- Imports: prefer `@/` alias for `src/*` modules with `.js` extension.

## Testing Guidelines
- Framework: `tape` (run through `tsx` runners).
- Test files: `*.test.ts`; integration tests use `*.int.test.ts`.
- Keep tests in the matching suite directory (`unit`, `integration`, `e2e`).
- Run `npm test` before opening a PR; add tests for behavior changes.

## Commit & Pull Request Guidelines
- Branching: create branches from `dev`; open PRs back to `dev`.
- Commit style: prefer Conventional Commit format seen in history, e.g. `fix(pool): prevent nonce exhaustion`, `docs(api): update examples`, `release: v2.0.2`.
- PRs should include: purpose, key changes, test coverage (`npm test` output), and any breaking-change notes.

## Security & Configuration Tips
Do not file public issues for vulnerabilities. Use GitHub private advisories: `https://github.com/frostr-org/bifrost/security/advisories/new`.
