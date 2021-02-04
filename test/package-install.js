'use strict';


const { execSync } = require('child_process');
const path = require('path');
const { readFileSync } = require('fs');

var assert = require('assert');

describe('Package install', () => {
	it('should remove non-`nodebb-` modules not specified in `install/package.json`', () => {
		const packageFilePath = path.join(__dirname, '../package.json');

		// install an extra package
		// chose dotenv because it's a popular package
		// and we use nconf instead
		execSync('npm install dotenv --save --production');

		// assert it saves in package.json
		const packageWithExtras = JSON.parse(readFileSync(packageFilePath, 'utf8'));
		assert(packageWithExtras.dependencies.dotenv, 'dependency did not save');

		// update the package file
		require('../src/cli/package-install').updatePackageFile();

		// assert it removed the extra package
		const packageCleaned = JSON.parse(readFileSync(packageFilePath, 'utf8'));
		assert(!packageCleaned.dependencies.dotenv, 'dependency was not removed');
	});
});
