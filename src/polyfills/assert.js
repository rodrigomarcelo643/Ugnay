/**
 * 100% Standalone, Zero-Dependency Polyfill for Node 'assert' module in Metro / React Native runtime.
 */

function assert(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.ok = assert;

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) {
    throw new Error(message || `Assertion failed: ${actual} == ${expected}`);
  }
};

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    throw new Error(message || `Assertion failed: ${actual} != ${expected}`);
  }
};

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Assertion failed: ${actual} === ${expected}`);
  }
};

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    throw new Error(message || `Assertion failed: ${actual} !== ${expected}`);
  }
};

assert.deepEqual = assert.equal;
assert.deepStrictEqual = assert.strictEqual;
assert.throws = function throws(block, error, message) {
  let threw = false;
  try {
    block();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || 'Missing expected exception');
  }
};

assert.doesNotThrow = function doesNotThrow(block, message) {
  try {
    block();
  } catch (e) {
    throw new Error(message || `Got unexpected exception: ${e.message}`);
  }
};

assert.ifError = function ifError(err) {
  if (err) throw err;
};

module.exports = assert;
