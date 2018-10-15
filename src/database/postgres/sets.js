'use strict';

var async = require('async');

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	module.setAdd = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(value)) {
			value = [value];
		}

		module.transaction(function (tx, done) {
			var query = tx.client.query.bind(tx.client);

			async.series([
				async.apply(helpers.ensureLegacyObjectType, tx.client, key, 'set'),
				async.apply(query, {
					name: 'setAdd',
					text: `
INSERT INTO "legacy_set" ("_key", "member")
SELECT $1::TEXT, m
  FROM UNNEST($2::TEXT[]) m
    ON CONFLICT ("_key", "member")
    DO NOTHING`,
					values: [key, value],
				}),
			], function (err) {
				done(err);
			});
		}, callback);
	};

	module.setsAdd = function (keys, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		if (!Array.isArray(value)) {
			value = [value];
		}

		keys = keys.filter(function (k, i, a) {
			return a.indexOf(k) === i;
		});

		module.transaction(function (tx, done) {
			var query = tx.client.query.bind(tx.client);

			async.series([
				async.apply(helpers.ensureLegacyObjectsType, tx.client, keys, 'set'),
				async.apply(query, {
					name: 'setsAdd',
					text: `
INSERT INTO "legacy_set" ("_key", "member")
SELECT k, m
  FROM UNNEST($1::TEXT[]) k
 CROSS JOIN UNNEST($2::TEXT[]) m
    ON CONFLICT ("_key", "member")
    DO NOTHING`,
					values: [keys, value],
				}),
			], function (err) {
				done(err);
			});
		}, callback);
	};

	module.setRemove = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(key)) {
			key = [key];
		}

		if (!Array.isArray(value)) {
			value = [value];
		}

		db.query({
			name: 'setRemove',
			text: `
DELETE FROM "legacy_set"
 WHERE "_key" = ANY($1::TEXT[])
   AND "member" = ANY($2::TEXT[])`,
			values: [key, value],
		}, function (err) {
			callback(err);
		});
	};

	module.setsRemove = function (keys, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		db.query({
			name: 'setsRemove',
			text: `
DELETE FROM "legacy_set"
 WHERE "_key" = ANY($1::TEXT[])
   AND "member" = $2::TEXT`,
			values: [keys, value],
		}, function (err) {
			callback(err);
		});
	};

	module.isSetMember = function (key, value, callback) {
		if (!key) {
			return callback(null, false);
		}

		db.query({
			name: 'isSetMember',
			text: `
SELECT 1
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
    ON o."_key" = s."_key"
   AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT
   AND s."member" = $2::TEXT`,
			values: [key, value],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, !!res.rows.length);
		});
	};

	module.isSetMembers = function (key, values, callback) {
		if (!key || !Array.isArray(values) || !values.length) {
			return callback(null, []);
		}

		values = values.map(helpers.valueToString);

		db.query({
			name: 'isSetMembers',
			text: `
SELECT s."member" m
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT
   AND s."member" = ANY($2::TEXT[])`,
			values: [key, values],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, values.map(function (v) {
				return res.rows.some(function (r) {
					return r.m === v;
				});
			}));
		});
	};

	module.isMemberOfSets = function (sets, value, callback) {
		if (!Array.isArray(sets) || !sets.length) {
			return callback(null, []);
		}

		value = helpers.valueToString(value);

		db.query({
			name: 'isMemberOfSets',
			text: `
SELECT o."_key" k
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = ANY($1::TEXT[])
   AND s."member" = $2::TEXT`,
			values: [sets, value],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, sets.map(function (s) {
				return res.rows.some(function (r) {
					return r.k === s;
				});
			}));
		});
	};

	module.getSetMembers = function (key, callback) {
		if (!key) {
			return callback(null, []);
		}

		db.query({
			name: 'getSetMembers',
			text: `
SELECT s."member" m
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (r) {
				return r.m;
			}));
		});
	};

	module.getSetsMembers = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}

		db.query({
			name: 'getSetsMembers',
			text: `
SELECT o."_key" k,
       array_agg(s."member") m
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = ANY($1::TEXT[])
 GROUP BY o."_key"`,
			values: [keys],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, keys.map(function (k) {
				return (res.rows.find(function (r) {
					return r.k === k;
				}) || { m: [] }).m;
			}));
		});
	};

	module.setCount = function (key, callback) {
		if (!key) {
			return callback(null, 0);
		}

		db.query({
			name: 'setCount',
			text: `
SELECT COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, parseInt(res.rows[0].c, 10));
		});
	};

	module.setsCount = function (keys, callback) {
		db.query({
			name: 'setsCount',
			text: `
SELECT o."_key" k,
       COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = ANY($1::TEXT[])
 GROUP BY o."_key"`,
			values: [keys],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, keys.map(function (k) {
				return (res.rows.find(function (r) {
					return r.k === k;
				}) || { c: 0 }).c;
			}));
		});
	};

	module.setRemoveRandom = function (key, callback) {
		callback = callback || helpers.noop;

		db.query({
			name: 'setRemoveRandom',
			text: `
WITH A AS (
	SELECT s."member"
	  FROM "legacy_object_live" o
	 INNER JOIN "legacy_set" s
	         ON o."_key" = s."_key"
	        AND o."type" = s."type"
	 WHERE o."_key" = $1::TEXT
	 ORDER BY RANDOM()
	 LIMIT 1
	   FOR UPDATE)
DELETE FROM "legacy_set" s
 USING A
 WHERE s."_key" = $1::TEXT
   AND s."member" = A."member"
RETURNING A."member" m`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].m);
			}

			callback(null, null);
		});
	};
};
