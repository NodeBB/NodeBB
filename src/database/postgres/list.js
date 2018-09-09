'use strict';

var async = require('async');

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	function listGet(key, callback) {
		db.query({
			name: 'listGet',
			text: `SELECT "list_getValues"($1::TEXT) "l"`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.length ? res.rows[0].l : null);
		});
	}

	function listSub(start, stop, list, callback) {
		if (list) {
			if (stop < 0) {
				stop += list.length;
			}
			list = list.slice(start, stop + 1);
		}
		callback(null, list);
	}

	function listSet(key, list, callback) {
		// making this a no-op makes the rest of the code simpler
		if (!list) {
			return callback();
		}

		db.query({
			name: 'listSet',
			text: `SELECT "list_setValues"($1::TEXT, $2::TEXT[])`,
			values: [key, list],
		}, function (err) {
			callback(err);
		});
	}

	module.listPrepend = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		module.transaction(function (tx, done) {
			async.waterfall([
				async.apply(listGet, key),
				function (list, next) {
					next(null, [value].concat(list || []));
				},
				async.apply(listSet, key),
			], function (err) {
				done(err);
			});
		}, callback);
	};

	module.listAppend = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		module.transaction(function (tx, done) {
			async.waterfall([
				async.apply(listGet, key),
				function (list, next) {
					next(null, (list || []).concat([value]));
				},
				async.apply(listSet, key),
			], function (err) {
				done(err);
			});
		}, callback);
	};

	module.listRemoveLast = function (key, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		var value = null;

		module.transaction(function (tx, done) {
			async.waterfall([
				async.apply(listGet, key),
				function (list, next) {
					if (list && list.length) {
						value = list.pop();
					}
					next(null, list);
				},
				async.apply(listSet, key),
			], function (err) {
				done(err);
			});
		}, function (err) {
			callback(err, value);
		});
	};

	module.listRemoveAll = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		module.transaction(function (tx, done) {
			async.waterfall([
				async.apply(listGet, key),
				function (list, next) {
					if (list) {
						list = list.filter(function (v) {
							return v !== value;
						});
					}
					next(null, list);
				},
				async.apply(listSet, key),
			], function (err) {
				done(err);
			});
		}, callback);
	};

	module.listTrim = function (key, start, stop, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		module.transaction(function (tx, done) {
			async.waterfall([
				async.apply(listGet, key),
				async.apply(listSub, start, stop),
				async.apply(listSet, key),
			], function (err) {
				done(err);
			});
		}, callback);
	};

	module.getListRange = function (key, start, stop, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		listGet(key, function (err, list) {
			if (err) {
				return callback(err);
			}

			if (!list) {
				list = [];
			}

			listSub(start, stop, list, callback);
		});
	};

	module.listLength = function (key, callback) {
		callback = callback || helpers.noop;

		listGet(key, function (err, list) {
			if (err) {
				return callback(err);
			}

			if (!list) {
				list = [];
			}

			callback(null, list.length);
		});
	};
};
