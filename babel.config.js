/**
 * Babel config used by @babel/register when running mocha tests.
 * Webpack does NOT use Babel — it consumes the ESM source as-is — so this
 * config is test-only. It compiles ESM to CommonJS so Node + Mocha can load
 * the source under test. Module path resolution (the webpack-style root
 * imports like `util/foo`) is handled via NODE_PATH in the test script.
 */
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }]
    ]
};
