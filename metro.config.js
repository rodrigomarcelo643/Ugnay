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

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      // Set permissive Content-Security-Policy to allow scripts, websockets, and dev tools
      res.setHeader(
        'Content-Security-Policy',
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' blob:; script-src-elem * 'unsafe-inline' 'unsafe-eval' blob:; style-src * 'unsafe-inline'; connect-src * 'unsafe-inline' blob: data: ws: wss:;"
      );

      // SPA rewrite for deep links: if requesting HTML on web (e.g. /caller/voice), rewrite to '/'
      const url = req.url || '';
      const isHtmlReq = req.headers.accept && req.headers.accept.includes('text/html');
      const isNotStaticFile =
        !url.includes('.bundle') &&
        !url.includes('.js') &&
        !url.includes('.css') &&
        !url.includes('.png') &&
        !url.includes('.ico') &&
        !url.includes('.json') &&
        !url.startsWith('/assets') &&
        !url.startsWith('/node_modules') &&
        !url.startsWith('/__') &&
        !url.startsWith('/_');

      if (isHtmlReq && isNotStaticFile && url !== '/' && !url.startsWith('/?')) {
        req.url = '/';
      }

      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = withNativeWind(config, { input: "./src/global.css" });