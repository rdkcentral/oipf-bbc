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
