const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');

const isDev = process.env.ELEVENTY_ENV === 'development';

const baseFilename = isDev ? 'main' : 'main.[contenthash]';

module.exports = {
  entry: [
    path.resolve(__dirname, 'src', 'site', 'js', 'main.js'),
    path.resolve(__dirname, 'src', 'site', 'scss', 'main.scss'),
  ],
  output: {
    path: path.resolve(__dirname, 'dist', 'assets'),
    // filename: `${baseFilename}.js`,
  },

  optimization: {
    minimize: !isDev,
    minimizer: [new TerserPlugin({ parallel: true })],
  },

  module: {
    rules: [
      {
        test: /\.s[ac]ss$/i,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          {
            loader: 'css-loader',
            options: {
              url: false,
            },
          },
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
              sassOptions: {
                outputStyle: 'expanded',
              },
            },
          },
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        ],
      },
      // {
      //   test: /\.css$/,
      //   use: [
      //     MiniCssExtractPlugin.loader,
      //     {
      //       loader: 'css-loader',
      //       options: {
      //         importLoaders: 1,
      //       },
      //     },
      //     'postcss-loader',
      //   ],
      // },
    ],
  },

  plugins: [
    new WebpackManifestPlugin({ publicPath: '/assets/' }),
    new MiniCssExtractPlugin({ filename: `${baseFilename}.css` }),
  ],
};