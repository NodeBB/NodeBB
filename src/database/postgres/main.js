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
		query(`DELETE FROM "legacy_object"`, function (err) {
			callback(err);
		});
	};

	module.exists = function (key, callback) {
		if (!key) {
			return callback();
		}

		if (Array.isArray(key)) {
			query({
				name: 'existsArray',
				text: `
				SELECT o."_key" k
  				FROM "legacy_object_live" o
 				WHERE o."_key" = ANY($1::TEXT[])`,
				values: [key],
			}, function (err, res) {
				if (err) {
					return callback(err);
				}

				callback(null, key.map(function (k) {
					return res.rows.some(function (r) {
						return r.k === k;
					});
				}));
			});
		} else {
			query({
				name: 'exists',
				text: `
	SELECT EXISTS(SELECT *
					FROM "legacy_object_live"
				   WHERE "_key" = $1::TEXT
				   LIMIT 1) e`,
				values: [key],
			}, function (err, res) {
				if (err) {
					return callback(err);
				}

				callback(null, res.rows[0].e);
			});
		}
	};

	module.delete = function (key, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}

		query({
			name: 'delete',
			text: `
DELETE FROM "legacy_object"
 WHERE "_key" = $1::TEXT`,
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
DELETE FROM "legacy_object"
 WHERE "_key" = ANY($1::TEXT[])`,
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
			text: `
SELECT s."data" t
  FROM "legacy_object_live" o
 INNER JOIN "legacy_string" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT
 LIMIT 1`,
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

		module.transaction(function (tx, done) {
			async.series([
				async.apply(helpers.ensureLegacyObjectType, tx.client, key, 'string'),
				async.apply(tx.client.query.bind(tx.client), {
					name: 'set',
					text: `
INSERT INTO "legacy_string" ("_key", "data")
VALUES ($1::TEXT, $2::TEXT)
    ON CONFLICT ("_key")
    DO UPDATE SET "data" = $2::TEXT`,
					values: [key, value],
				}),
			], function (err) {
				done(err);
			});
		}, callback);
	};

	module.increment = function (key, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		module.transaction(function (tx, done) {
			async.waterfall([
				async.apply(helpers.ensureLegacyObjectType, tx.client, key, 'string'),
				async.apply(tx.client.query.bind(tx.client), {
					name: 'increment',
					text: `
INSERT INTO "legacy_string" ("_key", "data")
VALUES ($1::TEXT, '1')
    ON CONFLICT ("_key")
    DO UPDATE SET "data" = ("legacy_string"."data"::NUMERIC + 1)::TEXT
RETURNING "data" d`,
					values: [key],
				}),
			], function (err, res) {
				if (err) {
					return done(err);
				}

				done(null, parseFloat(res.rows[0].d));
			});
		}, callback);
	};

	module.rename = function (oldKey, newKey, callback) {
		module.transaction(function (tx, done) {
			async.series([
				async.apply(tx.delete, newKey),
				async.apply(tx.client.query.bind(tx.client), {
					name: 'rename',
					text: `
UPDATE "legacy_object"
   SET "_key" = $2::TEXT
 WHERE "_key" = $1::TEXT`,
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
			text: `
SELECT "type"::TEXT t
  FROM "legacy_object_live"
 WHERE "_key" = $1::TEXT
 LIMIT 1`,
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
			text: `
UPDATE "legacy_object"
   SET "expireAt" = $2::TIMESTAMPTZ
 WHERE "_key" = $1::TEXT`,
			values: [key, date],
		}, function (err) {
			if (callback) {
				callback(err);
			}
		});
	}

	module.expire = function (key, seconds, callback) {
		doExpire(key, new Date(((Date.now() / 1000) + seconds) * 1000), callback);
	};

	module.expireAt = function (key, timestamp, callback) {
		doExpire(key, new Date(timestamp * 1000), callback);
	};

	module.pexpire = function (key, ms, callback) {
		doExpire(key, new Date(Date.now() + parseInt(ms, 10)), callback);
	};

	module.pexpireAt = function (key, timestamp, callback) {
		doExpire(key, new Date(timestamp), callback);
	};
};
