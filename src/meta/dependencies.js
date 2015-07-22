'use strict';

var path = require('path'),
	fs = require('fs'),
	async = require('async'),
	semver = require('semver'),
	winston = require('winston'),

	pkg = require.main.require('./package.json');

module.exports = function(Meta) {
	Meta.dependencies = {};

	Meta.dependencies.check = function(callback) {
		var modules = Object.keys(pkg.dependencies);
		winston.verbose('Checking dependencies for outdated modules');

		async.every(modules, function(module, next) {
			fs.readFile(path.join(__dirname, '../../node_modules/', module, 'package.json'), {
				encoding: 'utf-8'
			}, function(err, pkgData) {
				try {
					var pkgData = JSON.parse(pkgData),
						ok = semver.satisfies(pkgData.version, pkg.dependencies[module]);

					if (ok || pkgData._resolved.indexOf('//github.com') != -1) {
						next(true);
					} else {
						process.stdout.write('[' + 'outdated'.yellow + '] ' + module.bold + ' v' + pkgData.version + ', requires ' + pkg.dependencies[module] + '\n')
						next(false);
					}
				} catch(e) {
					winston.error('[meta.dependencies] Could not read: ' + module);
					process.exit();
				}
			})
		}, function(ok) {
			callback(!ok && global.env !== 'development' ? new Error('dependencies-out-of-date') : null);
		});
	};
};
