# @sudobility/routing

A framework-agnostic route registry, link grammar, and `Navigator` contract
shared by the family's web apps (react-router, URL paths) and React Native apps
(react-navigation, a stack/tab tree + deep links).

The two platforms run on different navigation engines, so no single router
*object* can drive both. What they **can** share is this package: the route
names, their param shapes, and the pure path↔route functions. Each app binds
its own navigator to a registry built here; a domain package owns the base
registry, and an app extends it with its own extra routes.

The core (`@sudobility/routing`) is pure: no React, no react-router, no
react-navigation, no DOM — just strings and types, so it tree-shakes and runs
anywhere. The React binding (`@sudobility/routing/react`) is a thin context +
hook and is the only part that imports React (as an optional peer dependency).

## Install

Published to **GitHub Packages** under the `@sudobility` scope. Consumers need
an `.npmrc` that points the scope at the GitHub registry:

```
@sudobility:registry=https://npm.pkg.github.com
```

Then install with your package manager (this repo uses [Bun](https://bun.sh)):

```sh
bun add @sudobility/routing
# or: npm install @sudobility/routing
```

`react` (>=18) is an **optional** peer dependency — only needed if you import
`@sudobility/routing/react`.

## Usage

### Define a route registry

```ts
import { defineRoutes, route } from '@sudobility/routing';

export const routes = defineRoutes({
  projects: route('/projects'),
  editor: route<{ projectId?: string }>('/editor/:projectId?'),
  published: route<{ publicId: string }>('/p/:publicId'),
});
```

`route<P>('/path/:param?')` declares a route; the `P` type parameter carries the
param shape (phantom — erased at runtime) so `build` is typed per route. Path
patterns use `:name` for required params and `:name?` for optional ones.

### Build and parse paths

```ts
routes.build('published', { publicId: 'a b' }); // '/p/a%20b' (params are URL-encoded)
routes.build('editor');                          // '/editor' (optional param dropped)
routes.build('published', {});                   // throws: missing required param "publicId"

routes.parse('/editor/x1');                      // { name: 'editor', params: { projectId: 'x1' } }
routes.parse('/editor/x1?foo=1#h');              // same — query and hash are ignored
routes.parse('https://host.com/p/pub-1');        // scheme + host are stripped
routes.parse('app:///p/pub-1');                  // deep-link scheme also handled
routes.parse('/nope');                           // null
```

`parse` tries routes most-specific-first (more literal segments, then more total
segments), so `/credits/history` wins over `/credits/:tab?`.

### Extend a base registry

An app adds its own screens to a shared (domain) registry. The base's routes win
on a name clash, so an extension can never silently redefine a shared route:

```ts
import { extendRoutes, route } from '@sudobility/routing';

const web = extendRoutes(routes, {
  home: route('/'),
  legal: route<{ doc?: string }>('/legal/:doc?'),
});
```

### Navigate through the `Navigator` contract (React)

Shared UI navigates by route name and never imports a navigation library. Each
app implements the `Navigator` interface over its own engine and provides it
through context:

```tsx
import { createNavigatorContext } from '@sudobility/routing/react';
import type { Navigator } from '@sudobility/routing';

type Routes = typeof routes.routes;
const { NavigatorProvider, useNavigator } = createNavigatorContext<Routes>();

// In the app shell, pass your engine-specific Navigator implementation:
// <NavigatorProvider value={myNavigator}>…</NavigatorProvider>

// In shared UI:
function Button() {
  const nav = useNavigator(); // throws if outside a provider
  return <button onClick={() => nav.go('projects')}>Projects</button>;
}
```

The `Navigator<M>` contract is `go`, `replace`, `back`, and `current`, all typed
against the registry's route names.

## Public API

Core (`@sudobility/routing`): `route`, `defineRoutes`, `extendRoutes`, and the
types `RouteParams`, `RouteDef`, `RouteMap`, `ParamsOf`, `RouteMatch`,
`Registry`, `Navigator`.

React (`@sudobility/routing/react`): `createNavigatorContext` and the
`NavigatorContext` type.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run build` | `tsc` type-check, then `vite build` (ESM JS), then `tsc -p tsconfig.build.json` (`.d.ts`), then `scripts/fix-esm-imports.mjs` |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | `eslint src` |
| `bun run test:unit` | run the Vitest suite once |
| `bun run test:watch` | Vitest in watch mode |
| `bun run clean` | remove `dist/` |
| `bun run verify` | typecheck + lint + test + build (the full gate) |

## Build notes

- **Two entry points:** the core (`.` → `src/index.ts`) and the React adapter
  (`./react` → `src/react.tsx`). Vite emits the JS; `tsc` emits the `.d.ts`
  tree (the vite dts plugin pulls in a broken dependency tree under this
  install, so `tsc` is used instead and doubles as the type-check gate).
- **`scripts/fix-esm-imports.mjs`** is a post-build step that rewrites `tsc`'s
  extensionless relative import specifiers (e.g. `./index`) to fully-qualified
  ESM paths (`./index.js`) so Node's native ESM loader can resolve the output.
  It is idempotent and dependency-free.

## Project layout

```
src/
  index.ts          core: route, defineRoutes, extendRoutes, Registry, Navigator
  react.tsx         React binding: createNavigatorContext
  registry.test.ts  tests for build / parse / specificity / extendRoutes
  react.test.tsx    tests for the context + hook (incl. compile-time typing)
scripts/
  fix-esm-imports.mjs
```

## CI/CD

`.github/workflows/ci-cd.yml` delegates to the shared
`johnqh/workflows/.github/workflows/unified-cicd.yml` reusable workflow on push
and PR to `main` and `develop`. With `publish-target: github`, a successful run
on `main` publishes the package to GitHub Packages.
