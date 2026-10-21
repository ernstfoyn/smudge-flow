/* Shared, renderer-independent parameter and keyframe evaluation.
 * Tracks address arbitrary nested properties; interpolation belongs to the
 * outgoing keyframe, leaving room for easing/Bezier/hold without renderer changes.
 */
(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  function get(entity, path) { return path.split('.').reduce((v, key) => v?.[key], entity); }
  function set(entity, path, value) {
    const keys = path.split('.'); const last = keys.pop();
    const target = keys.reduce((v, key) => v[key] ||= {}, entity); target[last] = value;
  }
  function mix(a, b, t) {
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
    if (typeof a === 'string' && /^#[0-9a-f]{6}$/i.test(a) && /^#[0-9a-f]{6}$/i.test(b)) {
      const channels = [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t));
      return '#' + channels.map(v => v.toString(16).padStart(2, '0')).join('');
    }
    return t < 1 ? a : b; // Discrete types (object type, enums, strings).
  }
  const interpolators = { linear: mix, hold: (a, b, t) => t < 1 ? a : b };
  function valueAt(base, keys = [], frame) {
    if (!keys.length) return base;
    if (frame <= keys[0].frame) return keys[0].value;
    if (frame >= keys[keys.length - 1].frame) return keys[keys.length - 1].value;
    let lo = 0, hi = keys.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid].frame <= frame) lo = mid; else hi = mid; }
    const a = keys[lo], b = keys[hi];
    const interpolate = interpolators[a.interpolation] || interpolators.linear;
    return interpolate(a.value, b.value, (frame - a.frame) / (b.frame - a.frame));
  }
  function evaluate(entity, frame) {
    const result = copy(entity);
    Object.entries(entity.tracks || {}).forEach(([path, keys]) => set(result, path, valueAt(get(entity, path), keys, frame)));
    return result;
  }
  function upsert(entity, path, frame, value, interpolation = 'linear') {
    entity.tracks ||= {}; const keys = entity.tracks[path] ||= [];
    const found = keys.find(k => k.frame === frame);
    if (found) found.value = value;
    else keys.push({ frame, value, interpolation });
    keys.sort((a, b) => a.frame - b.frame);
  }
  function remove(entity, path, frame) {
    if (!entity.tracks?.[path]) return;
    entity.tracks[path] = entity.tracks[path].filter(k => k.frame !== frame);
    if (!entity.tracks[path].length) delete entity.tracks[path];
  }
  const api = { copy, get, set, mix, valueAt, evaluate, upsert, remove, interpolators };
  root.AnimationCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
