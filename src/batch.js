

'use strict';

var async = require('async'),
	db = require('./database'),
	utils = require('../public/src/utils');

(function(Batch) {

	var DEFAULT_BATCH_SIZE = 100;

	Batch.processSortedSet = function(setKey, process, options, callback) {
		if (typeof options === 'function') {
			callback = options;
			options = {};
		}

		callback = typeof callback === 'function' ? callback : function(){};
		options = options || {};

		if (typeof process !== 'function') {
			return callback(new Error('[[error:process-not-a-function]]'));
		}

		// use the fast path if possible
		if (db.processSortedSet && typeof options.doneIf !== 'function' && !utils.isNumber(options.alwaysStartAt)) {
			return db.processSortedSet(setKey, process, options.batch || DEFAULT_BATCH_SIZE, callback);
		}

		// custom done condition
		options.doneIf = typeof options.doneIf === 'function' ? options.doneIf : function(){};

		var batch = options.batch || DEFAULT_BATCH_SIZE;
		var start = 0;
		var stop = batch;
		var done = false;

		async.whilst(
			function() {
				return !done;
			},
			function(next) {
				db.getSortedSetRange(setKey, start, stop, function(err, ids) {
					if (err) {
						return next(err);
					}
					if (!ids.length || options.doneIf(start, stop, ids)) {
						done = true;
						return next();
					}
					process(ids, function(err) {
						if (err) {
							return next(err);
						}
						start += utils.isNumber(options.alwaysStartAt) ? options.alwaysStartAt : batch + 1;
						stop = start + batch;
						next();
					});
				});
			},
			callback
		);
	};

}(exports));
