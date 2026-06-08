/**
 * This file zips the contents of the dist directory after a build and places in file called oipf-bbc_x-x-x.zip
 */


var zip = require('bestzip');

zip({
	cwd: './dist',
	source: '*',
	destination: 'oipf-bbc_' + process.env.npm_package_version + '.zip'
}).then(function() {
	console.log('Distribution zipped');
}).catch(function(err) {
	console.error(err.stack);
	process.exit(1);
});
