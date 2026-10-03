/**
 * 100% Standalone, Dependency-Free Browser Polyfill for Node 'crypto' module in Metro.
 * Provides SHA-256 HMAC, timingSafeEqual, and randomBytes with zero external npm dependencies.
 */

function rightRotate(n, b) {
  return (n >>> b) | (n << (32 - b));
}

function sha256(bytes) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const l = bytes.length;
  const bitLen = l * 8;
  const padLen = (l % 64 < 56) ? 56 - (l % 64) : 120 - (l % 64);
  const buf = new Uint8Array(l + padLen + 8);
  buf.set(bytes);
  buf[l] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(buf.length - 4, bitLen, false);

  const W = new Int32Array(64);

  for (let i = 0; i < buf.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getInt32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = (rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3));
      const s1 = (rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10));
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeInt32BE(H[i], i * 4);
  }
  return out;
}

function hmacSha256(key, message) {
  let keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(key);
  let msgBuf = Buffer.isBuffer(message) ? message : Buffer.from(message);

  const blockSize = 64;
  if (keyBuf.length > blockSize) {
    keyBuf = sha256(keyBuf);
  }
  if (keyBuf.length < blockSize) {
    const paddedKey = Buffer.alloc(blockSize);
    keyBuf.copy(paddedKey);
    keyBuf = paddedKey;
  }

  const oKeyPad = Buffer.alloc(blockSize);
  const iKeyPad = Buffer.alloc(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = keyBuf[i] ^ 0x5c;
    iKeyPad[i] = keyBuf[i] ^ 0x36;
  }

  const innerHash = sha256(Buffer.concat([iKeyPad, msgBuf]));
  return sha256(Buffer.concat([oKeyPad, innerHash]));
}

class HmacHelper {
  constructor(algo, key) {
    this.algo = algo;
    this.key = Buffer.isBuffer(key) ? key : Buffer.from(key);
    this.chunks = [];
  }

  update(chunk) {
    if (chunk) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return this;
  }

  digest(encoding) {
    const message = Buffer.concat(this.chunks);
    const result = hmacSha256(this.key, message);
    if (encoding === 'hex') return result.toString('hex');
    if (encoding === 'base64') return result.toString('base64');
    return result;
  }
}

class HashHelper {
  constructor(algo) {
    this.algo = algo;
    this.chunks = [];
  }
  update(chunk) {
    if (chunk) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return this;
  }
  digest(encoding) {
    const message = Buffer.concat(this.chunks);
    const result = sha256(message);
    if (encoding === 'hex') return result.toString('hex');
    if (encoding === 'base64') return result.toString('base64');
    return result;
  }
}

function createHmac(algo, key) {
  return new HmacHelper(algo, key);
}

function createHash(algo) {
  return new HashHelper(algo);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  let out = 0;
  for (let i = 0; i < bufA.length; i++) {
    out |= bufA[i] ^ bufB[i];
  }
  return out === 0;
}

function randomBytes(size) {
  const buf = Buffer.alloc(size);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < size; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  return buf;
}

module.exports = {
  createHmac: createHmac,
  createHash: createHash,
  timingSafeEqual: timingSafeEqual,
  randomBytes: randomBytes,
  pseudoRandomBytes: randomBytes,
};
