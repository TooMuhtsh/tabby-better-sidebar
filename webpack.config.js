const path = require('path')

/**
 * Exported as a function rather than a plain object so the config can see the
 * mode webpack was actually started with. `npm run build:prod` passes
 * `--mode production` on the command line, which webpack-cli merges *over*
 * whatever the config says — so `mode` below was correct, but every other
 * setting kept its development value, `devtool` and `pathinfo` included. A
 * production build was minified and still shipped a source map.
 */
module.exports = (env, argv) => {
  const isProduction = (argv?.mode ?? process.env.NODE_ENV) === 'production'

  return {
    target: 'node',
    entry: 'src/index.ts',
    // Never in the published package: `files: ["dist"]` ships the whole folder,
    // and index.js.map alone weighed 886 KB for a consumer who has no source to
    // step into anyway. Kept in development, where it is the point.
    devtool: isProduction ? false : 'source-map',
    context: __dirname,
    mode: isProduction ? 'production' : 'development',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.js',
      // Module paths inlined as comments: useful while debugging locally, pure
      // weight next to minified code.
      pathinfo: !isProduction,
      // No `clean: true` here, however tempting: the .d.ts files that
      // `typings` points at are written straight to dist/ by TypeScript
      // (`declarationDir` in tsconfig.json), not emitted as webpack assets —
      // verified by building to a different --output-path, which produced
      // index.js alone. Cleaning would collect them as strays and publish a
      // package with no typings. The stale source map is removed by the
      // build:prod script instead.
      libraryTarget: 'umd',
      devtoolModuleFilenameTemplate: 'webpack-tabby-sidebar-plus:///[resource-path]',
    },
    resolve: {
      modules: ['.', 'src', 'node_modules'].map(x => path.join(__dirname, x)),
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.json'),
          },
        },
        {
          test: /\.scss$/,
          use: ['style-loader', 'css-loader', 'sass-loader'],
        },
        { test: /\.pug$/, use: ['apply-loader', 'pug-loader'] },
      ],
    },
    externals: [
      'fs',
      'path',
      'ngx-toastr',
      /^rxjs/,
      /^@angular/,
      /^@ng-bootstrap/,
      /^tabby-/,
    ],
  }
}
