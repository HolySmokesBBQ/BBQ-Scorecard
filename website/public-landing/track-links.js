// Click tracking for the links the weekly brief reads: store badges, app launches,
// episode links. Website only (loaded on / and /episodes), never in public/.
//
// Every parameter is a fixed label copied from a data-* attribute and checked
// against the allowlists below; anything else sends nothing. No URLs, no ids,
// nothing a visitor typed. Events go through window.gtag, so they inherit the
// consent model in gtm-init.js: queued where a grant is required and not yet
// given, dropped after a denial, sent by default elsewhere. The event list here
// is the sender inventory the auditor reads against the consent text.
(function () {
  'use strict';
  var EVENTS = {
    app_store_click: {
      app: ['scorecard', 'board', 'notebook'],
      store: ['google_play', 'app_store'],
      placement: ['apps_grid']
    },
    app_launch_click: {
      app: ['scorecard', 'board', 'notebook', 'calculator'],
      placement: ['apps_grid']
    },
    episode_click: {
      episode: ['pilot', 'ep2', 'ep3', 'ep4', 'list', 'channel'],
      placement: ['still', 'button', 'subscribe', 'hero_cta', 'home_card']
    }
  };
  document.addEventListener('click', function (e) {
    var t = e.target;
    var el = t && t.closest ? t.closest('[data-track]') : null;
    if (!el || typeof window.gtag !== 'function') return;
    var name = el.getAttribute('data-track');
    var spec = EVENTS[name];
    if (!spec) return;
    var params = {};
    for (var key in spec) {
      var v = el.getAttribute('data-' + key);
      if (spec[key].indexOf(v) < 0) return;
      params[key] = v;
    }
    window.gtag('event', name, params);
  }, { passive: true });
})();
