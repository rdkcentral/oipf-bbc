/*
 * Copyright (c) 2026 Infosys
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const smp = new SpeedMeasurePlugin({
    disable: true  //set to false to see the time taken for each part of the webpack build in the console output
});

const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserWebpackPlugin = require('terser-webpack-plugin'); // replaced uglifyjs-webpack-plugin for WebPack 5v
const CleanWebpackPlugin = require('clean-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin'); // replaced optimize-css-assets-webpack-plugin for WebPack 5v
const GitRevisionPlugin = require('git-revision-webpack-plugin');
const gitRevisionPlugin = new GitRevisionPlugin({branch: true});
const CreateFileWebpack = require('create-file-webpack');
const ESLintPlugin = require('eslint-webpack-plugin'); // replaced JSHint for WebPack 5v
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const distributionDirName = 'dist';
const distributionDirPath = path.resolve(__dirname, distributionDirName)

module.exports = function(env, argv) {
    let isDev = argv.mode === 'development';

    const config = {
        name: 'oipf-bbc',

        entry: {
            'oipf-bbc': './lib/oipf/bbcOipfAndOsdk.js'
        },
        resolve: {
            modules: [path.resolve(__dirname, 'lib')] //this makes the root of module includes the ./lib directory
        },
        output: {
            // as no library property is provided this will add all properties of the entry point to the window object
            libraryTarget: 'window',
            filename: '[name].js',
            path: distributionDirPath + '/stb',
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    enforce: 'pre',
                    exclude: /node_modules/,
                    use: [
                        {
                            loader: 'prettier-loader',
                            options: {
                                parser: 'babylon',
                                tabWidth: 4,
                                singleQuote: true,
                                printWidth: 150
                            }
                        }
                    ]
                },

                {
                    test: /\.(tmpl\.html)$/,
                    use: {
                        loader: 'html-loader',
                        options: {
                            minimize: true
                        }
                    }
                },
                {
                    test: /\.scss$/,
                    use: [
                        MiniCssExtractPlugin.loader,  //This places css in seperate .css files
                        'css-loader',
                        'sass-loader'
                    ]
                }
            ]
        },

        optimization: {
            minimizer: [
                new TerserWebpackPlugin({
                    // prevents creation of LICENSE.txt files
                    // see https://stackoverflow.com/questions/64818489/webpack-omit-creation-of-license-txt-files
                    extractComments: false,
                    //create the terser plugin so we can customise terser config
                    terserOptions: {
                        warnings: true,
                        compress: { drop_console: ['debug', 'log', 'info'] } // remove console.log statements
                    }
                }),
                new CssMinimizerPlugin({})
            ]
        },

        plugins: [
            new CleanWebpackPlugin([distributionDirName]),
            new MiniCssExtractPlugin({
                filename: '[name].css'
            }),
            new webpack.DefinePlugin({
                //define global js values that are inserted into the javascript
                __DEVELOPMENT__: JSON.stringify(isDev), // __DEVELOPMENT__ is used so dev only code is removed in production builds.
                __VERSION__: JSON.stringify(process.env.npm_package_version + "_" + gitRevisionPlugin.commithash().slice(0,7)),
            }),
            new webpack.BannerPlugin({
                banner: `${process.env.npm_package_name} - ${process.env.npm_package_version}`
            }),
            new CreateFileWebpack({
                path: distributionDirPath,
                fileName: 'commits.txt',
                content: JSON.stringify(process.env.npm_package_name + " (" + process.env.npm_package_version + ") built from hash " + gitRevisionPlugin.commithash() + " branch " + gitRevisionPlugin.branch())
            }),
            new ESLintPlugin(),
            // Uncomment to get a html page showing modules in bundle and their size visually
            /*
            new BundleAnalyzerPlugin({
                generateStatsFile : true
            })
            */
        ]
    };

    // Test app — a real HTML app (not a library), so it gets its own entry/output/
    // plugins rather than sharing the lib config's libraryTarget/banner/versioning.
    // The oipf-bbc library itself is deliberately never imported here: harness/
    // loader.js resolves it at runtime (local bundled copy or platform-injected
    // global), so `bbc`/`oipfObjectFactory`/`onesdk`/`getPrimaryDisplay` are just
    // free globals as far as this bundle is concerned.
    //
    // withLib: whether to copy the built library (dist/stb/) into this build's own
    // output (testapp/dist/stb/) so harness/loader.js's 'stb/oipf-bbc.js' fetch has
    // something to find. Always on in dev (serve:testapp) so ?lib=local works
    // locally; in production it's opt-in via `webpack --env withLib` (see the
    // build:testapp:dev npm script) — the default production build stays
    // standalone, relying on the platform to inject the library instead.
    const libStbDir = path.resolve(__dirname, 'dist/stb');
    const withLib = isDev || !!(env && env.withLib);
    if (withLib && !require('fs').existsSync(libStbDir)) {
        console.warn('Note: ' + libStbDir + ' not found — run `npm run build` first ' +
            'so the test app has a local library copy to embed.');
    }

    const testAppConfig = {
        name: 'testapp',
        entry: {
            testapp: './testapp/src/index.ts'
        },
        resolve: {
            modules: [path.resolve(__dirname, 'testapp'), 'node_modules'],
            extensions: ['.ts', '.js']
        },
        output: {
            filename: '[name].bundle.js',
            path: path.resolve(__dirname, 'testapp/dist'),
            publicPath: '',
            clean: true
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            configFile: path.resolve(__dirname, 'testapp/tsconfig.json')
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: [MiniCssExtractPlugin.loader, 'css-loader']
                }
            ]
        },
        optimization: {
            minimizer: [
                new TerserWebpackPlugin({ extractComments: false }),
                new CssMinimizerPlugin({})
            ]
        },
        plugins: [
            new MiniCssExtractPlugin({ filename: '[name].css' }),
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, 'testapp/index.html'),
                filename: 'index.html',
                inject: 'body',
                // Deployed to devices via the bolt package — keep it un-minified so the
                // template's own license header survives in the built artifact (the JS/CSS
                // bundles below get an equivalent banner since Terser strips comments).
                minify: false
            }),
            new webpack.BannerPlugin({
                banner: 'Copyright (c) 2026 Infosys. Licensed under the Apache License, Version 2.0.',
                test: /\.(js|css)$/
            }),
            ...(withLib ? [
                new CopyWebpackPlugin({
                    patterns: [
                        { from: libStbDir, to: 'stb', noErrorOnMissing: true }
                    ]
                })
            ] : [])
        ],
        devServer: {
            port: process.env.PORT || 8137
        }
    };

    return [smp.wrap(config), testAppConfig];
};
