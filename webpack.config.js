const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
const smp = new SpeedMeasurePlugin({
    disable: true  //set to false to see the time taken for each part of the webpack build in the console output
});

const merge = require('webpack-merge');
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

const distributionDirName = 'dist';
const distributionDirPath = path.resolve(__dirname, distributionDirName)

module.exports = function(env, argv) {
    let isDev = argv.mode === 'development';

    const config = {

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
                    test: /.js/,
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
            new ESLintPlugin({
                exclude: './lib/util/sjcl.js'
            }),
            // Uncomment to get a html page showing modules in bundle and their size visually
            /*
            new BundleAnalyzerPlugin({
                generateStatsFile : true
            })
            */
        ]
    };
    

    return [smp.wrap(config)];
};
