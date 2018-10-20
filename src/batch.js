

'use strict';

var async = require('async');
var db = require('./database');
var utils = require('./utils');

var DEFAULT_BATCH_SIZE = 100;

exports.processSortedSet = function (setKey, process, options, callback) {
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	callback = typeof callback === 'function' ? callback : function () {};
	options = options || {};

	if (typeof process !== 'function') {
		return callback(new Error('[[error:process-not-a-function]]'));
	}

	// Progress bar handling (upgrade scripts)
	if (options.progress) {
		db.sortedSetCard(setKey, function (err, total) {
			if (!err) {
				options.progress.total = total;
			}
		});
	}

	options.batch = options.batch || DEFAULT_BATCH_SIZE;

	// use the fast path if possible
	if (db.processSortedSet && typeof options.doneIf !== 'function' && !utils.isNumber(options.alwaysStartAt)) {
		return db.processSortedSet(setKey, process, options, callback);
	}

	// custom done condition
	options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function () {};

	var start = 0;
	var stop = options.batch;
	var done = false;

	async.whilst(
		function () {
			return !done;
		},
		function (next) {
			async.waterfall([
				function (next) {
					db['getSortedSetRange' + (options.withScores ? 'WithScores' : '')](setKey, start, stop, next);
				},
				function (ids, _next) {
					if (!ids.length || options.doneIf(start, stop, ids)) {
						done = true;
						return next();
					}
					process(ids, function (err) {
						_next(err);
					});
				},
				function (next) {
					start += utils.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : options.batch + 1;
					stop = start + options.batch;

					if (options.interval) {
						setTimeout(next, options.interval);
					} else {
						next();
					}
				},
			], next);
		},
		callback
	);
};

exports.processArray = function (array, process, options, callback) {
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	callback = typeof callback === 'function' ? callback : function () {};
	options = options || {};

	if (!Array.isArray(array) || !array.length) {
		return callback();
	}
	if (typeof process !== 'function') {
		return callback(new Error('[[error:process-not-a-function]]'));
	}

	var batch = options.batch || DEFAULT_BATCH_SIZE;
	var start = 0;
	var done = false;

	async.whilst(
		function () {
			return !done;
		},
		function (next) {
			var currentBatch = array.slice(start, start + batch);
			if (!currentBatch.length) {
				done = true;
				return next();
			}
			async.waterfall([
				function (next) {
					process(currentBatch, function (err) {
						next(err);
					});
				},
				function (next) {
					start += batch;
					if (options.interval) {
						setTimeout(next, options.interval);
					} else {
						next();
					}
				},
			], next);
		},
		function (err) {
			callback(err);
		}
	);
};
