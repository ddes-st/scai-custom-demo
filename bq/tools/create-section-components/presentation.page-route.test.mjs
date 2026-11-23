import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pageRouteFromCaptureUrl } from './presentation.mjs';

describe('pageRouteFromCaptureUrl', () => {
  it('treats locale-only paths as home', () => {
    assert.deepEqual(pageRouteFromCaptureUrl('https://www.dom-security.com/be/en'), {
      pageKey: 'home',
      routePath: '/',
      isHome: true,
    });
  });

  it('maps newsroom listing to a secondary page', () => {
    const r = pageRouteFromCaptureUrl('https://www.dom-security.com/be/en/newsroom');
    assert.equal(r.isHome, false);
    assert.equal(r.routePath, '/newsroom');
    assert.equal(r.pageKey, 'newsroom');
  });

  it('maps nested article URLs', () => {
    const r = pageRouteFromCaptureUrl(
      'https://www.dom-security.com/be/en/newsroom/group-news/new-silca-machine-dom-hoberg',
    );
    assert.equal(r.isHome, false);
    assert.equal(r.routePath, '/newsroom/group-news/new-silca-machine-dom-hoberg');
    assert.equal(r.pageKey, 'newsroom-group-news-new-silca-machine-dom-hoberg');
  });
});
