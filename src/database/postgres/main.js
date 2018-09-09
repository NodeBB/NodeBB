'use strict';

var async = require('async');

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	var query = db.query.bind(db);

	module.flushdb = function (callback) {
		callback = callback || helpers.noop;

		async.series([
			async.apply(query, `DROP SCHEMA "public" CASCADE`),
			async.apply(query, `CREATE SCHEMA "public"`),
		], function (err) {
			callback(err);
		});
	};

	module.emptydb = function (callback) {
		callback = callback || helpers.noop;
		query(`SELECT "delete_all_data_from_database"()`, function (err) {
			callback(err);
		});
	};

	module.exists = function (key, callback) {
		if (!key) {
			return callback();
		}

		query({
			name: 'exists',
			text: `SELECT "object_exists"($1::TEXT) "e"`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows[0].e);
		});
	};

	module.delete = function (key, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}

		query({
			name: 'delete',
			text: `SELECT "object_delete"($1::TEXT)`,
			values: [key],
		}, function (err) {
			callback(err);
		});
	};

	module.deleteAll = function (keys, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		query({
			name: 'deleteAll',
			text: `
SELECT "object_delete"("_key")
  FROM UNNEST($1::TEXT[]) k("_key")`,
			values: [keys],
		}, function (err) {
			callback(err);
		});
	};

	module.get = function (key, callback) {
		if (!key) {
			return callback();
		}

		query({
			name: 'get',
			text: `SELECT "string_getValue"($1::TEXT) "t"`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].t);
			}

			callback(null, null);
		});
	};

	module.set = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		query({
			name: 'set',
			text: `SELECT "string_setValue"($1::TEXT, $2::TEXT)`,
			values: [key, value],
		}, function (err) {
			callback(err);
		});
	};

	module.increment = function (key, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		query({
			name: 'increment',
			text: `SELECT "string_incrValue"($1::TEXT, 1) "v"`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows[0].v);
		});
	};

	module.rename = function (oldKey, newKey, callback) {
		module.transaction(function (tx, done) {
			async.series([
				async.apply(tx.delete, newKey),
				async.apply(tx.client.query.bind(tx.client), {
					name: 'rename',
					text: `SELECT "object_rename"($1::TEXT, $2::TEXT)`,
					values: [oldKey, newKey],
				}),
			], function (err) {
				done(err);
			});
		}, callback || helpers.noop);
	};

	module.type = function (key, callback) {
		query({
			name: 'type',
			text: `SELECT "object_getType"($1::TEXT)::TEXT "t"`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].t);
			}

			callback(null, null);
		});
	};

	function doExpire(key, date, callback) {
		query({
			name: 'expire',
			text: `SELECT "object_expireAt"($1::TEXT, $2::TIMESTAMPTZ)`,
			values: [key, new Date(date)],
		}, function (err) {
			if (callback) {
				callback(err);
			}
		});
	}

	module.expire = function (key, seconds, callback) {
		doExpire(key, Date.now() + (seconds * 1000), callback);
	};

	module.expireAt = function (key, timestamp, callback) {
		doExpire(key, timestamp * 1000, callback);
	};

	module.pexpire = function (key, ms, callback) {
		doExpire(key, Date.now() + parseInt(ms, 10), callback);
	};

	module.pexpireAt = function (key, timestamp, callback) {
		doExpire(key, timestamp, callback);
	};
};
