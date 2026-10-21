// Door to /yourpit/: the arrow-key code then B A, or 7 quick taps or clicks on the homepage logo.
// Keeps only a place in the code and a tap count with its time. Stores and sends nothing.
(function () {
  'use strict';
  var Q = ['u', 'u', 'd', 'd', 'l', 'r', 'l', 'r', 'b', 'a'];
  var K = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', b: 'b', a: 'a' };
  var SKIP = 'input,select,textarea,[contenteditable]';
  var D = document, O = { passive: true }, logo = D.querySelector('img.logo');
  var pos = 0, last = 0, taps = 0, tapAt = 0, done = false;
  function open() {
    if (done) return;
    done = true;
    D.removeEventListener('keydown', key, O);
    if (logo) logo.removeEventListener('click', tap, O);
    location.assign('/yourpit/');
  }
  function key(e) {
    if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && e.target.closest && e.target.closest(SKIP)) return;
    var k = e.key || '', x = K[k.length === 1 ? k.toLowerCase() : k], n = Date.now();
    if (n - last > 1500) pos = 0;
    last = n;
    pos = x === Q[pos] ? pos + 1 : x === 'u' ? (pos && Q[pos - 1] === 'u' ? 2 : 1) : 0;
    if (pos === 10) open();
  }
  function tap() {
    var n = Date.now();
    taps = n - tapAt > 1200 ? 1 : taps + 1;
    tapAt = n;
    if (taps >= 7) open();
  }
  D.addEventListener('keydown', key, O);
  if (logo) logo.addEventListener('click', tap, O);
})();
