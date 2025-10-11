const { merge } = require('webpack-merge');
const common = require('./webpack.config.js');module.exports = merge(common, {
  mode: 'development',
  // Allow watching and live reloading of assets
  watch: true,
});
