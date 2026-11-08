import { describe, expect, it } from 'vitest';
import { defineRoutes, extendRoutes, route } from './index';

const routes = defineRoutes({
  projects: route('/projects'),
  editor: route<{ projectId?: string }>('/editor/:projectId?'),
  published: route<{ publicId: string }>('/p/:publicId'),
  docs: route<{ topicId?: string }>('/docs/:topicId?'),
  credits: route('/credits'),
});

describe('build', () => {
  it('builds a static path', () => {
    expect(routes.build('projects')).toBe('/projects');
  });
  it('substitutes a required param and encodes it', () => {
    expect(routes.build('published', { publicId: 'a b' })).toBe('/p/a%20b');
  });
  it('includes an optional param when present', () => {
    expect(routes.build('editor', { projectId: 'x1' })).toBe('/editor/x1');
  });
  it('drops an optional param when absent', () => {
    expect(routes.build('editor')).toBe('/editor');
    expect(routes.build('editor', {})).toBe('/editor');
  });
  it('throws on a missing required param', () => {
    // @ts-expect-error deliberately omitting the required param to test the guard
    expect(() => routes.build('published', {})).toThrow(/publicId/);
  });
});

describe('parse', () => {
  it('matches a static path', () => {
    expect(routes.parse('/projects')).toEqual({ name: 'projects', params: {} });
  });
  it('matches with a required param and decodes it', () => {
    expect(routes.parse('/p/a%20b')).toEqual({
      name: 'published',
      params: { publicId: 'a b' },
    });
  });
  it('matches an optional param present and absent', () => {
    expect(routes.parse('/editor/x1')).toEqual({
      name: 'editor',
      params: { projectId: 'x1' },
    });
    expect(routes.parse('/editor')).toEqual({ name: 'editor', params: {} });
  });
  it('ignores a trailing slash, query and hash', () => {
    expect(routes.parse('/projects/')).toEqual({ name: 'projects', params: {} });
    expect(routes.parse('/editor/x1?foo=1#h')).toEqual({
      name: 'editor',
      params: { projectId: 'x1' },
    });
  });
  it('strips a scheme + host from a full URL', () => {
    expect(routes.parse('https://moosiac.com/p/pub-1')).toEqual({
      name: 'published',
      params: { publicId: 'pub-1' },
    });
    expect(routes.parse('moosiac:///p/pub-1')).toEqual({
      name: 'published',
      params: { publicId: 'pub-1' },
    });
  });
  it('returns null for an unknown path', () => {
    expect(routes.parse('/nope/nowhere')).toBeNull();
  });
  it('does not match a longer path against a shorter route', () => {
    expect(routes.parse('/projects/extra')).toBeNull();
  });
});

describe('specificity', () => {
  const r = defineRoutes({
    creditsHistory: route('/credits/history'),
    credits: route<{ tab?: string }>('/credits/:tab?'),
  });
  it('prefers the more literal route', () => {
    expect(r.parse('/credits/history')).toEqual({
      name: 'creditsHistory',
      params: {},
    });
    expect(r.parse('/credits/overview')).toEqual({
      name: 'credits',
      params: { tab: 'overview' },
    });
  });
});

describe('extendRoutes', () => {
  const web = extendRoutes(routes, {
    home: route('/'),
    legal: route<{ doc?: string }>('/legal/:doc?'),
  });
  it('keeps the base routes', () => {
    expect(web.build('projects')).toBe('/projects');
    expect(web.parse('/p/x')).toEqual({ name: 'published', params: { publicId: 'x' } });
  });
  it('adds the new routes', () => {
    expect(web.build('home')).toBe('/');
    expect(web.parse('/legal/terms')).toEqual({ name: 'legal', params: { doc: 'terms' } });
  });
  it('lists all names', () => {
    expect(web.names().sort()).toEqual(
      ['credits', 'docs', 'editor', 'home', 'legal', 'projects', 'published'].sort(),
    );
  });
});
