# CLAUDE.md

## What this is

`@sudobility/routing` — a framework-agnostic route registry, link grammar, and
`Navigator` contract shared by the family's web (react-router) and React Native
(react-navigation) apps. The two platforms use different navigation engines, so
this package shares only route names, param shapes, and pure path↔route
functions. Published to **GitHub Packages** under `@sudobility`.

## Stack

- TypeScript (strict), ESM-only (`"type": "module"`), `sideEffects: false`.
- Bun as package manager (`bun.lock`). Vite (lib mode) builds JS; Vitest tests;
  ESLint (flat config) lints; `tsc` type-checks and emits `.d.ts`.
- React is an **optional** peer dep (`>=18`), used only by the `./react` entry.

## Commands (verified)

```sh
bun run typecheck    # tsc --noEmit
bun run lint         # eslint src   (passes with 4 pre-existing non-null-assertion warnings)
bun run test:unit    # vitest run   (18 tests, 2 files)
bun run build        # tsc && vite build && tsc -p tsconfig.build.json && node scripts/fix-esm-imports.mjs
bun run verify       # typecheck + lint + test:unit + build — the full gate
```

`verify` is the gate run before publish (`prepublishOnly`).

## Architecture

Two entry points, both built to `dist/`:

- **`src/index.ts`** (core, `@sudobility/routing`) — pure, no React/DOM/router
  imports. Exports: `route`, `defineRoutes`, `extendRoutes`, types `Registry`,
  `Navigator`, `RouteDef`, `RouteMap`, `ParamsOf`, `RouteMatch`, `RouteParams`.
  - `defineRoutes` compiles paths to segments and orders routes
    most-specific-first (more literals, then more segments) for `parse`.
  - `extendRoutes(base, extra)` merges — **base routes win on name clash**.
  - `build` URL-encodes params and throws on a missing required param; `parse`
    strips scheme+host and query/hash, decodes params, returns `null` on no match.
- **`src/react.tsx`** (`@sudobility/routing/react`) — only file importing React.
  `createNavigatorContext<M>()` returns `{ NavigatorProvider, useNavigator }`;
  the hook throws outside a provider. Each app supplies its own `Navigator`
  implementation over its engine; shared UI calls `useNavigator().go('name')`.

## Key conventions / gotchas

- **Route params are always `string | undefined`** (as in a URL). The `P` type
  on `route<P>()`/`RouteDef` is a phantom — erased at runtime, only types `build`.
- **`:name?` optional vs. query `?`:** pattern segments are NOT query-stripped
  (the trailing `?` marks an optional param); real paths passed to `parse` ARE
  query/hash-stripped. These are two different code paths (`compile`/`rawSegments`
  vs. `splitPath`) — don't merge them.
- **Build uses `tsc` for `.d.ts`, not the vite dts plugin** (the plugin pulls in
  a broken dependency tree under this install). `tsconfig.json` is `noEmit`
  (type-check only); `tsconfig.build.json` is `emitDeclarationOnly`.
- **`scripts/fix-esm-imports.mjs` is a required post-build step.** `tsc` under
  `moduleResolution: "bundler"` emits extensionless relative imports that Node's
  ESM loader rejects; this rewrites them to `./x.js`. Idempotent, dependency-free.
  Don't drop it from the `build` script.
- Lint targets `src/**/*.ts` only; the 4 non-null-assertion warnings in
  `index.ts` are expected, not errors.

## CI/CD

`.github/workflows/ci-cd.yml` calls the shared reusable workflow
`johnqh/workflows/.github/workflows/unified-cicd.yml@main` on push/PR to `main`
and `develop`, with `publish-target: github` (publishes to GitHub Packages on
`main`). Note: the workflow's header comment says "NPM" but the target is
GitHub Packages.
