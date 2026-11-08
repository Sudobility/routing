import { describe, expect, it } from 'vitest';
import { createNavigatorContext } from './react';
import { defineRoutes, route, type Navigator } from './index';

const routes = defineRoutes({ projects: route('/projects') });
type Routes = typeof routes.routes;

describe('createNavigatorContext', () => {
  it('returns a provider and a hook', () => {
    const ctx = createNavigatorContext<Routes>();
    expect(typeof ctx.NavigatorProvider).toBe('function');
    expect(typeof ctx.useNavigator).toBe('function');
  });

  it('types go() against the registry (compile-time)', () => {
    // A no-op navigator just to exercise the types; the real impl lives per app.
    const nav: Navigator<Routes> = {
      go: () => {},
      replace: () => {},
      back: () => {},
      current: () => null,
    };
    nav.go('projects');
    // @ts-expect-error unknown route name
    nav.go('nope');
    expect(nav.current()).toBeNull();
  });
});
