module.exports = {
    require: ['@babel/register', './test/setup.js'],
    spec: ['test/**/*.test.js'],
    timeout: 5000,
    exit: true
};
