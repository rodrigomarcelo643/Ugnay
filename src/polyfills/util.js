/**
 * Browser polyfill for Node 'util' module in Metro / React Native Web.
 */

function inherits(ctor, superCtor) {
  if (superCtor) {
    ctor.super_ = superCtor;
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  }
}

module.exports = {
  inherits: inherits,
  format: function (fmt, ...args) {
    return String(fmt);
  },
  inspect: function (obj) {
    return String(obj);
  },
  deprecate: function (fn) {
    return fn;
  },
  isBuffer: function (b) {
    return typeof Buffer !== 'undefined' && Buffer.isBuffer(b);
  },
  promisify: function (fn) {
    return function (...args) {
      return new Promise((resolve, reject) => {
        fn(...args, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
  }
};
