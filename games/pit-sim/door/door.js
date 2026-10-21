// Door to /yourpit/: the code by keys, or swipes then two taps. Keeps only its place in the code.
(function () {
  'use strict';
  var Q = ['u', 'u', 'd', 'd', 'l', 'r', 'l', 'r', 'b', 'a'];
  var K = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', b: 'b', a: 'a' };
  var SKIP = 'a,button,input,select,textarea,label,summary,video,[role=button],[contenteditable],dialog[open]';
  var D = document, O = { passive: true }, pos = 0, last = 0, done = false, s = null;
  function feed(x) {
    var n = Date.now();
    if (n - last > 1500) pos = 0;
    last = n;
    pos = x === Q[pos] ? pos + 1 : x === 'u' ? (pos && Q[pos - 1] === 'u' ? 2 : 1) : 0;
    if (pos === 10 && !done) {
      done = true;
      on('removeEventListener');
      location.assign('/yourpit/');
    }
  }
  function skip(t) { return !!(t && t.closest && t.closest(SKIP)); }
  function key(e) {
    if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || skip(e.target)) return;
    var k = e.key || '', x = K[k.length === 1 ? k.toLowerCase() : k];
    if (x) feed(x); else pos = 0;
  }
  function start(e) {
    var p = e.touches[0];
    s = e.touches.length === 1 && !skip(e.target) ? { x: p.clientX, y: p.clientY, t: Date.now() } : null;
  }
  function end(e) {
    var a = s;
    s = null;
    if (!a || e.touches.length) { pos = 0; return; }
    var p = e.changedTouches[0], dx = p.clientX - a.x, dy = p.clientY - a.y, dt = Date.now() - a.t;
    var X = Math.abs(dx), Y = Math.abs(dy), M = Math.max(X, Y);
    if (M < 10 && dt <= 300) feed(pos === 9 ? 'a' : 'b');
    else if (dt <= 700 && M >= 40 && M >= 1.5 * Math.min(X, Y)) feed(Y > X ? (dy < 0 ? 'u' : 'd') : (dx < 0 ? 'l' : 'r'));
    else pos = 0;
  }
  function cancel() { s = null; pos = 0; }
  function on(m) {
    D[m]('keydown', key, O);
    D[m]('touchstart', start, O);
    D[m]('touchend', end, O);
    D[m]('touchcancel', cancel, O);
  }
  on('addEventListener');
})();
