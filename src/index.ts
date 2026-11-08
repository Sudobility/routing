/**
 * A framework-agnostic route registry, link grammar and navigation contract.
 *
 * The web app (react-router, URL paths) and the React Native app
 * (react-navigation, a stack/tab tree + deep links) run on different navigation
 * engines, so no single router *object* can drive both. What they CAN share is
 * this: the route names, their param shapes, and the pure path↔route functions.
 * Each app binds its own navigator to a registry built here; a domain package
 * (e.g. music_lib) owns the base registry, and an app extends it with its own
 * extra routes via {@link extendRoutes}. Shared UI navigates through the
 * {@link Navigator} contract (see `@sudobility/routing/react`) and never imports
 * a navigation library.
 *
 * Pure: no React, no react-router, no react-navigation, no DOM. Just strings
 * and types, so it tree-shakes and runs anywhere.
 */

/** Route params are always strings (as they appear in a URL); optional ones may be absent. */
export type RouteParams = Record<string, string | undefined>;

/**
 * One route: a path pattern with `:name` and optional `:name?` segments. The
 * `P` type parameter carries the param shape so {@link Registry.build} is typed
 * per route; it is a phantom (erased at runtime).
 */
export interface RouteDef<P extends RouteParams = RouteParams> {
  readonly path: string;
  /** Phantom carrier for the param type; never read at runtime. */
  readonly __params?: P;
}

/** Declare a route. `route<{ projectId?: string }>('/editor/:projectId?')`. */
export function route<P extends RouteParams = RouteParams>(
  path: string,
): RouteDef<P> {
  return { path };
}

export type RouteMap = Record<string, RouteDef>;

/** The param shape of route `K` in map `M`. */
export type ParamsOf<M extends RouteMap, K extends keyof M> =
  M[K] extends RouteDef<infer P> ? P : RouteParams;

/** A resolved route: its name and the params pulled from the path. */
export interface RouteMatch<M extends RouteMap> {
  readonly name: keyof M;
  readonly params: RouteParams;
}

export interface Registry<M extends RouteMap> {
  /** The underlying route map, for an adapter that iterates it (e.g. to build `<Routes>`). */
  readonly routes: M;
  /** All route names, insertion order preserved. */
  names(): (keyof M)[];
  /** Build the path for a route, substituting params. Throws on a missing required param. */
  build<K extends keyof M>(name: K, params?: ParamsOf<M, K>): string;
  /**
   * Match a path (or full URL) against the registry, longest/most-specific
   * first, returning the route name and its params, or null if none match.
   */
  parse(pathOrUrl: string): RouteMatch<M> | null;
}

type Segment =
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'param'; readonly name: string; readonly optional: boolean };

function compile(path: string): Segment[] {
  // Pattern segments — NOT query-stripped, because a pattern's `?` marks an
  // optional param (`:projectId?`), it is not the start of a query string.
  return rawSegments(path).map(raw => {
    if (raw.startsWith(':')) {
      const optional = raw.endsWith('?');
      const name = raw.slice(1, optional ? -1 : undefined);
      return { kind: 'param', name, optional };
    }
    return { kind: 'literal', value: raw };
  });
}

/** Split on `/`, ignoring a leading/trailing slash. No query/hash handling. */
function rawSegments(path: string): string[] {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return clean === '' ? [] : clean.split('/');
}

/** An actual URL path → segments, dropping any query/hash (only valid for real paths). */
function splitPath(path: string): string[] {
  return rawSegments(path.replace(/[?#].*$/, ''));
}

/** Strip a scheme + host (and anything before the first path slash) off a full URL. */
function pathOf(pathOrUrl: string): string {
  // moosiac:///en/editor, https://host/en/editor, or a bare /en/editor.
  const withoutScheme = pathOrUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const slash = withoutScheme.indexOf('/');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(pathOrUrl)) {
    // Had a scheme: drop the authority (up to the first slash).
    return slash === -1 ? '/' : withoutScheme.slice(slash);
  }
  return pathOrUrl;
}

function buildPath(segments: Segment[], params: RouteParams): string {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.kind === 'literal') {
      out.push(seg.value);
      continue;
    }
    const value = params[seg.name];
    if (value === undefined || value === '') {
      if (seg.optional) continue;
      throw new Error(`Missing required route param "${seg.name}"`);
    }
    out.push(encodeURIComponent(value));
  }
  return '/' + out.join('/');
}

function matchPath(
  segments: Segment[],
  parts: string[],
): RouteParams | null {
  const params: RouteParams = {};
  let i = 0;
  for (const seg of segments) {
    const part = parts[i];
    if (seg.kind === 'literal') {
      if (part !== seg.value) return null;
      i++;
      continue;
    }
    if (part === undefined) {
      // No more path parts: only match if this param (and all remaining) are optional.
      if (!seg.optional) return null;
      continue;
    }
    params[seg.name] = decodeURIComponent(part);
    i++;
  }
  // Every path part must have been consumed.
  return i === parts.length ? params : null;
}

/** Build a registry from a route map. */
export function defineRoutes<M extends RouteMap>(routes: M): Registry<M> {
  const compiled = new Map<keyof M, Segment[]>();
  for (const name of Object.keys(routes) as (keyof M)[]) {
    compiled.set(name, compile(routes[name].path));
  }
  // Most-specific first: more literal segments, then more total segments, wins —
  // so `/credits/history` is tried before a hypothetical `/credits/:x?`.
  const order = ([...compiled.keys()]).sort((a, b) => {
    const sa = compiled.get(a)!;
    const sb = compiled.get(b)!;
    const lit = (s: Segment[]) => s.filter(x => x.kind === 'literal').length;
    return lit(sb) - lit(sa) || sb.length - sa.length;
  });

  return {
    routes,
    names: () => Object.keys(routes) as (keyof M)[],
    build: (name, params) => buildPath(compiled.get(name)!, params ?? {}),
    parse: pathOrUrl => {
      const parts = splitPath(pathOf(pathOrUrl));
      for (const name of order) {
        const params = matchPath(compiled.get(name)!, parts);
        if (params) return { name, params };
      }
      return null;
    },
  };
}

/**
 * Extend a base registry with extra routes, yielding a registry typed over
 * both. The base's routes win on a name clash (the extension cannot silently
 * redefine a shared route). This is how an app adds its own screens — e.g.
 * music_app adds home/resources/legal to music_lib's shared registry.
 */
export function extendRoutes<A extends RouteMap, B extends RouteMap>(
  base: Registry<A>,
  extra: B,
): Registry<A & B> {
  return defineRoutes({ ...extra, ...base.routes } as A & B);
}

/**
 * What shared UI may ask of navigation, decoupled from how it happens. Each app
 * implements this over its own navigation library; a component calls
 * `useNavigator().go('projects')` and never touches react-router or
 * react-navigation. See `@sudobility/routing/react` for the context + hook.
 */
export interface Navigator<M extends RouteMap> {
  go<K extends keyof M>(name: K, params?: ParamsOf<M, K>): void;
  replace<K extends keyof M>(name: K, params?: ParamsOf<M, K>): void;
  back(): void;
  current(): RouteMatch<M> | null;
}
