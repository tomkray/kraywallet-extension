const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/taproot-signer-local.js',
  output: {
    filename: 'taproot-signer.bundle.js',
    path: path.resolve(__dirname, 'background'),
    library: 'TaprootSigner',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  mode: 'production',
  target: 'web',
  experiments: {
    asyncWebAssembly: true
  },
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/")
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ]
};

