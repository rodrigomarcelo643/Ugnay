/**
 * Browser polyfill for Node 'zlib' module in Metro / React Native Web.
 * Uses browserify-zlib binding internally to provide synchronous deflateSync / inflateSync.
 */

const browserifyZlib = require('browserify-zlib');
const binding = require('browserify-zlib/lib/binding');

function deflateSync(buf) {
  if (!buf) return Buffer.alloc(0);
  const inputBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

  const z = new binding.Zlib(binding.DEFLATE);
  z.init(15, 6, 8, 0);

  const out = Buffer.alloc(inputBuf.length * 2 + 1024);
  const res = z.writeSync(binding.Z_FINISH, inputBuf, 0, inputBuf.length, out, 0, out.length);
  z.close();

  const written = out.length - res[1];
  return out.subarray(0, written);
}

function inflateSync(buf) {
  if (!buf) return Buffer.alloc(0);
  const inputBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

  const z = new binding.Zlib(binding.INFLATE);
  z.init(15, 6, 8, 0);

  const out = Buffer.alloc(inputBuf.length * 4 + 1024);
  const res = z.writeSync(binding.Z_FINISH, inputBuf, 0, inputBuf.length, out, 0, out.length);
  z.close();

  const written = out.length - res[1];
  return out.subarray(0, written);
}

module.exports = {
  ...browserifyZlib,
  deflateSync: deflateSync,
  inflateSync: inflateSync,
  gzipSync: deflateSync,
  gunzipSync: inflateSync,
};
