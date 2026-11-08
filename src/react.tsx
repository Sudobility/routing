/**
 * The React binding for a {@link Navigator}: a context + hook so shared UI can
 * navigate by route name without importing a navigation library. Each app
 * provides the `Navigator` implementation (its react-router / react-navigation
 * adapter); components consume `useNavigator()`.
 */
import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from 'react';
import type { Navigator, RouteMap } from './index';

export interface NavigatorContext<M extends RouteMap> {
  /** Provides the app's navigator to the tree below. */
  NavigatorProvider: (props: {
    value: Navigator<M>;
    children: ReactNode;
  }) => ReactNode;
  /** Reads the navigator. Throws if used outside a provider. */
  useNavigator: () => Navigator<M>;
}

/**
 * Create a typed navigator context for a registry's route map. Call once per
 * app (or in the domain package, re-exported) so the `go('name')` calls are
 * checked against the real route names.
 */
export function createNavigatorContext<M extends RouteMap>(): NavigatorContext<M> {
  const Ctx = createContext<Navigator<M> | null>(null);

  function NavigatorProvider({
    value,
    children,
  }: {
    value: Navigator<M>;
    children: ReactNode;
  }): ReactNode {
    return createElement(Ctx.Provider, { value }, children);
  }

  function useNavigator(): Navigator<M> {
    const nav = useContext(Ctx);
    if (!nav) {
      throw new Error('useNavigator must be used within a NavigatorProvider');
    }
    return nav;
  }

  return { NavigatorProvider, useNavigator };
}
