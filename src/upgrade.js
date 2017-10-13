'use strict';

var async = require('async');
var path = require('path');
var semver = require('semver');
var readline = require('readline');

var db = require('./database');
var file = require('../src/file');

/*
 * Need to write an upgrade script for NodeBB? Cool.
 *
 * 1. Copy TEMPLATE to a file name of your choice. Try to be succinct.
 * 2. Open up that file and change the user-friendly name (can be longer/more descriptive than the file name)
 *    and timestamp (don't forget the timestamp!)
 * 3. Add your script under the "method" property
 */

var Upgrade = {};

Upgrade.getAll = function (callback) {
	async.waterfall([
		async.apply(file.walk, path.join(__dirname, './upgrades')),
		function (files, next) {
			// Sort the upgrade scripts based on version
			var versionA;
			var versionB;
			setImmediate(next, null, files.filter(function (file) {
				return path.basename(file) !== 'TEMPLATE';
			}).sort(function (a, b) {
				versionA = path.dirname(a).split('/').pop();
				versionB = path.dirname(b).split('/').pop();

				return semver.compare(versionA, versionB);
			}));
		},
	], callback);
};

Upgrade.check = function (callback) {
	// Throw 'schema-out-of-date' if not all upgrade scripts have run
	async.waterfall([
		async.apply(Upgrade.getAll),
		function (files, next) {
			db.getSortedSetRange('schemaLog', 0, -1, function (err, executed) {
				if (err) {
					return callback(err);
				}

				var remainder = files.filter(function (name) {
					return executed.indexOf(path.basename(name, '.js')) === -1;
				});

				next(remainder.length > 0 ? new Error('schema-out-of-date') : null);
			});
		},
	], callback);
};

Upgrade.run = function (callback) {
	process.stdout.write('\nParsing upgrade scripts... ');
	var queue = [];
	var skipped = 0;

	async.parallel({
		// Retrieve list of upgrades that have already been run
		completed: async.apply(db.getSortedSetRange, 'schemaLog', 0, -1),
		// ... and those available to be run
		available: Upgrade.getAll,
	}, function (err, data) {
		if (err) {
			return callback(err);
		}

		queue = data.available.reduce(function (memo, cur) {
			if (data.completed.indexOf(path.basename(cur, '.js')) === -1) {
				memo.push(cur);
			} else {
				skipped += 1;
			}

			return memo;
		}, queue);

		Upgrade.process(queue, skipped, callback);
	});
};

Upgrade.runParticular = function (names, callback) {
	process.stdout.write('\nParsing upgrade scripts... ');

	async.waterfall([
		async.apply(file.walk, path.join(__dirname, './upgrades')),
		function (files, next) {
			var upgrades = files.filter(function (file) {
				return names.indexOf(path.basename(file, '.js')) !== -1;
			});

			Upgrade.process(upgrades, 0, next);
		},
	], callback);
};

Upgrade.process = function (files, skipCount, callback) {
	process.stdout.write('OK'.green + ' | '.reset + String(files.length).cyan + ' script(s) found'.cyan + (skipCount > 0 ? ', '.cyan + String(skipCount).cyan + ' skipped'.cyan : '') + '\n'.reset);

	async.waterfall([
		function (next) {
			async.parallel({
				schemaDate: async.apply(db.get, 'schemaDate'),
				schemaLogCount: async.apply(db.sortedSetCard, 'schemaLog'),
			}, next);
		},
		function (results, next) {
			async.eachSeries(files, function (file, next) {
				var scriptExport = require(file);
				var date = new Date(scriptExport.timestamp);
				var version = path.dirname(file).split('/').pop();
				var progress = {
					current: 0,
					total: 0,
					incr: Upgrade.incrementProgress,
					script: scriptExport,
					date: date,
				};

				process.stdout.write('  → '.white + String('[' + [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()].join('/') + '] ').gray + String(scriptExport.name).reset + '...\n');

				// For backwards compatibility, cross-reference with schemaDate (if found). If a script's date is older, skip it
				if ((!results.schemaDate && !results.schemaLogCount) || (scriptExport.timestamp <= results.schemaDate && semver.lt(version, '1.5.0'))) {
					readline.clearLine(process.stdout, 0);
					readline.cursorTo(process.stdout, 0);
					readline.moveCursor(process.stdout, 0, -1);
					process.stdout.write('  → '.white + String('[' + [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()].join('/') + '] ').gray + String(scriptExport.name).reset + '... ' + 'skipped\n'.grey);
					db.sortedSetAdd('schemaLog', Date.now(), path.basename(file, '.js'), next);
					return;
				}

				// Do the upgrade...
				scriptExport.method.bind({
					progress: progress,
				})(function (err) {
					if (err) {
						process.stdout.write('error\n'.red);
						return next(err);
					}

					readline.clearLine(process.stdout, 0);
					readline.cursorTo(process.stdout, 0);
					readline.moveCursor(process.stdout, 0, -1);
					process.stdout.write('  → '.white + String('[' + [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()].join('/') + '] ').gray + String(scriptExport.name).reset + '... ' + 'OK\n'.green);

					// Record success in schemaLog
					db.sortedSetAdd('schemaLog', Date.now(), path.basename(file, '.js'), next);
				});
			}, next);
		},
		function (next) {
			process.stdout.write('Upgrade complete!\n\n'.green);
			setImmediate(next);
		},
	], callback);
};

Upgrade.incrementProgress = function () {
	this.current += 1;

	// Redraw the progress bar
	var percentage = 0;
	var filled = 0;
	var unfilled = 15;
	if (this.total) {
		percentage = Math.floor((this.current / this.total) * 100) + '%';
		filled = Math.floor((this.current / this.total) * 15);
		unfilled = 15 - filled;
	}

	readline.cursorTo(process.stdout, 0);
	process.stdout.write('    [' + (filled ? new Array(filled).join('#') : '') + new Array(unfilled).join(' ') + '] (' + this.current + '/' + (this.total || '??') + ') ' + percentage + ' ');
};

module.exports = Upgrade;
