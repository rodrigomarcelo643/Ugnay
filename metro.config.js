const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  assert: path.resolve(__dirname, 'src/polyfills/assert.js'),
  crypto: path.resolve(__dirname, 'src/polyfills/crypto.js'),
  events: path.resolve(__dirname, 'src/polyfills/events.js'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  zlib: path.resolve(__dirname, 'src/polyfills/zlib.js'),
  util: path.resolve(__dirname, 'src/polyfills/util.js'),
};

module.exports = withNativeWind(config, { input: "./src/global.css" });