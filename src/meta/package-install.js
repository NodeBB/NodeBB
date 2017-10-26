'use strict';

var path = require('path');
var fs = require('fs');
var cproc = require('child_process');

var packageFilePath = path.join(__dirname, '../../package.json');
var packageDefaultFilePath = path.join(__dirname, '../../package.default.json');

function updatePackageFile() {
	var oldPackageContents = {};

	try {
		oldPackageContents = JSON.parse(fs.readFileSync(packageFilePath, 'utf8'));
	} catch (e) {
		if (e.code !== 'ENOENT') {
			throw e;
		}
	}

	var defaultPackageContents = JSON.parse(fs.readFileSync(packageDefaultFilePath, 'utf8'));
	var packageContents = Object.assign({}, oldPackageContents, defaultPackageContents, {
		dependencies: Object.assign({}, oldPackageContents.dependencies, defaultPackageContents.dependencies),
	});

	fs.writeFileSync(packageFilePath, JSON.stringify(packageContents, null, 2));
}

exports.updatePackageFile = updatePackageFile;

function npmInstallProduction() {
	cproc.execSync('npm i --production', {
		cwd: path.join(__dirname, '../../'),
		stdio: [0, 1, 2],
	});
}

exports.npmInstallProduction = npmInstallProduction;
