'use strict';

var async = require('async');

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	module.listPrepend = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		module.transaction(function (tx, done) {
			var query = tx.client.query.bind(tx.client);

			async.series([
				async.apply(helpers.ensureLegacyObjectType, tx.client, key, 'list'),
				async.apply(query, {
					name: 'listPrepend',
					text: `
INSERT INTO "legacy_list" ("_key", "array")
VALUES ($1::TEXT, ARRAY[$2::TEXT])
    ON CONFLICT ("_key")
    DO UPDATE SET "array" = ARRAY[$2::TEXT] || "legacy_list"."array"`,
					values: [key, value],
				}),
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
			var query = tx.client.query.bind(tx.client);

			async.series([
				async.apply(helpers.ensureLegacyObjectType, tx.client, key, 'list'),
				async.apply(query, {
					name: 'listAppend',
					text: `
INSERT INTO "legacy_list" ("_key", "array")
VALUES ($1::TEXT, ARRAY[$2::TEXT])
    ON CONFLICT ("_key")
    DO UPDATE SET "array" = "legacy_list"."array" || ARRAY[$2::TEXT]`,
					values: [key, value],
				}),
			], function (err) {
				done(err);
			});
		}, callback || helpers.noop);
	};

	module.listRemoveLast = function (key, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		db.query({
			name: 'listRemoveLast',
			text: `
WITH A AS (
	SELECT l.*
	  FROM "legacy_object_live" o
	 INNER JOIN "legacy_list" l
	         ON o."_key" = l."_key"
	        AND o."type" = l."type"
	 WHERE o."_key" = $1::TEXT
	   FOR UPDATE)
UPDATE "legacy_list" l
   SET "array" = A."array"[1 : array_length(A."array", 1) - 1]
  FROM A
 WHERE A."_key" = l."_key"
RETURNING A."array"[array_length(A."array", 1)] v`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].v);
			}

			callback(null, null);
		});
	};

	module.listRemoveAll = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		db.query({
			name: 'listRemoveAll',
			text: `
UPDATE "legacy_list" l
   SET "array" = array_remove(l."array", $2::TEXT)
  FROM "legacy_object_live" o
 WHERE o."_key" = l."_key"
   AND o."type" = l."type"
   AND o."_key" = $1::TEXT`,
			values: [key, value],
		}, function (err) {
			callback(err);
		});
	};

	module.listTrim = function (key, start, stop, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		stop += 1;

		db.query(stop > 0 ? {
			name: 'listTrim',
			text: `
UPDATE "legacy_list" l
   SET "array" = ARRAY(SELECT m.m
                         FROM UNNEST(l."array") WITH ORDINALITY m(m, i)
                        ORDER BY m.i ASC
                        LIMIT ($3::INTEGER - $2::INTEGER)
                       OFFSET $2::INTEGER)
  FROM "legacy_object_live" o
 WHERE o."_key" = l."_key"
   AND o."type" = l."type"
   AND o."_key" = $1::TEXT`,
			values: [key, start, stop],
		} : {
			name: 'listTrimBack',
			text: `
UPDATE "legacy_list" l
   SET "array" = ARRAY(SELECT m.m
                         FROM UNNEST(l."array") WITH ORDINALITY m(m, i)
                        ORDER BY m.i ASC
                        LIMIT ($3::INTEGER - $2::INTEGER + array_length(l."array", 1))
                       OFFSET $2::INTEGER)
  FROM "legacy_object_live" o
 WHERE o."_key" = l."_key"
   AND o."type" = l."type"
   AND o."_key" = $1::TEXT`,
			values: [key, start, stop],
		}, function (err) {
			callback(err);
		});
	};

	module.getListRange = function (key, start, stop, callback) {
		if (!key) {
			return callback();
		}

		stop += 1;

		db.query(stop > 0 ? {
			name: 'getListRange',
			text: `
SELECT ARRAY(SELECT m.m
               FROM UNNEST(l."array") WITH ORDINALITY m(m, i)
              ORDER BY m.i ASC
              LIMIT ($3::INTEGER - $2::INTEGER)
             OFFSET $2::INTEGER) l
  FROM "legacy_object_live" o
 INNER JOIN "legacy_list" l
         ON o."_key" = l."_key"
        AND o."type" = l."type"
      WHERE o."_key" = $1::TEXT`,
			values: [key, start, stop],
		} : {
			name: 'getListRangeBack',
			text: `
SELECT ARRAY(SELECT m.m
               FROM UNNEST(l."array") WITH ORDINALITY m(m, i)
              ORDER BY m.i ASC
              LIMIT ($3::INTEGER - $2::INTEGER + array_length(l."array", 1))
             OFFSET $2::INTEGER) l
  FROM "legacy_object_live" o
 INNER JOIN "legacy_list" l
         ON o."_key" = l."_key"
        AND o."type" = l."type"
 WHERE o."_key" = $1::TEXT`,
			values: [key, start, stop],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].l);
			}

			callback(null, []);
		});
	};

	module.listLength = function (key, callback) {
		db.query({
			name: 'listLength',
			text: `
SELECT array_length(l."array", 1) l
  FROM "legacy_object_live" o
 INNER JOIN "legacy_list" l
         ON o."_key" = l."_key"
        AND o."type" = l."type"
      WHERE o."_key" = $1::TEXT`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].l);
			}

			callback(null, 0);
		});
	};
};
