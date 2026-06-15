/**
 * @param {string} seed
 */
export function createRng(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let state = hash >>> 0;
  return function rng() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {() => number} rng
 * @param {number} minInclusive
 * @param {number} maxExclusive
 */
export function randomInt(rng, minInclusive, maxExclusive) {
  return Math.floor(rng() * (maxExclusive - minInclusive)) + minInclusive;
}

/**
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 */
export function shuffled(items, rng) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function defaultSeed() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}
