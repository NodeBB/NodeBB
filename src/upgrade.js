/* jslint node: true */
'use strict';

var async = require('async');
var path = require('path');

var utils = require('../public/src/utils');

var Upgrade = {};

Upgrade.run = function (callback) {
	process.stdout.write('\nParsing upgrade scripts... ');

	utils.walk(path.join(__dirname, './upgrades'), function (err, files) {
		if (err) {
			return callback(err);
		}

		Upgrade.process(files, callback);
	});
};

Upgrade.runSingle = function (query, callback) {
	process.stdout.write('\nParsing upgrade scripts... ');

	async.waterfall([
		async.apply(utils.walk, path.join(__dirname, './upgrades')),
		function (files, next) {
			next(null, files.filter(function (file) {
				return file.search(new RegExp(query)) !== -1;
			}));
		}
	], function (err, files) {
		if (err) {
			return callback(err);
		}

		Upgrade.process(files, callback);
	});
};

Upgrade.process = function (files, callback) {
	process.stdout.write('OK'.green + String(' ' + files.length).cyan + ' script(s) found\n'.cyan);

	// Do I need to sort the files here? we'll see.
	// sort();

	async.eachSeries(files, function (file, next) {
		var scriptExport = require(file);
		var date = new Date(scriptExport.timestamp);

		process.stdout.write('  → '.white + String('[' + [date.getFullYear(), date.getMonth() + 1, date.getDate() + 1].join('/') + '] ').gray + String(scriptExport.name).reset + '... ');

		// Do the upgrade...
		scriptExport.method(function (err) {
			if (err) {
				process.stdout.write('error\n'.red);
				return next(err);
			}

			process.stdout.write('OK\n'.green);
			next();
		});
	}, function (err) {
		if (err) {
			return callback(err);
		}

		process.stdout.write('Upgrade complete!\n\n'.green);
		callback();
	});
};

module.exports = Upgrade;