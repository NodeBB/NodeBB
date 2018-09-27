'use strict';

var helpers = {};

helpers.valueToString = function (value) {
	if (value === null || value === undefined) {
		return value;
	}

	return value.toString();
};

helpers.removeDuplicateValues = function (values) {
	var others = Array.prototype.slice.call(arguments, 1);
	for (var i = 0; i < values.length; i++) {
		if (values.lastIndexOf(values[i]) !== i) {
			values.splice(i, 1);
			for (var j = 0; j < others.length; j++) {
				others[j].splice(i, 1);
			}
			i -= 1;
		}
	}
};

helpers.ensureLegacyObjectType = function (db, key, type, callback) {
	db.query({
		name: 'ensureLegacyObjectTypeBefore',
		text: `
DELETE FROM "legacy_object"
 WHERE "expireAt" IS NOT NULL
   AND "expireAt" <= CURRENT_TIMESTAMP`,
	}, function (err) {
		if (err) {
			return callback(err);
		}

		db.query({
			name: 'ensureLegacyObjectType1',
			text: `
INSERT INTO "legacy_object" ("_key", "type")
VALUES ($1::TEXT, $2::TEXT::LEGACY_OBJECT_TYPE)
    ON CONFLICT
    DO NOTHING`,
			values: [key, type],
		}, function (err) {
			if (err) {
				return callback(err);
			}

			db.query({
				name: 'ensureLegacyObjectType2',
				text: `
SELECT "type"
  FROM "legacy_object_live"
 WHERE "_key" = $1::TEXT`,
				values: [key],
			}, function (err, res) {
				if (err) {
					return callback(err);
				}

				if (res.rows[0].type !== type) {
					return callback(new Error('database: cannot insert ' + JSON.stringify(key) + ' as ' + type + ' because it already exists as ' + res.rows[0].type));
				}

				callback(null);
			});
		});
	});
};

helpers.ensureLegacyObjectsType = function (db, keys, type, callback) {
	db.query({
		name: 'ensureLegacyObjectTypeBefore',
		text: `
DELETE FROM "legacy_object"
 WHERE "expireAt" IS NOT NULL
   AND "expireAt" <= CURRENT_TIMESTAMP`,
	}, function (err) {
		if (err) {
			return callback(err);
		}

		db.query({
			name: 'ensureLegacyObjectsType1',
			text: `
INSERT INTO "legacy_object" ("_key", "type")
SELECT k, $2::TEXT::LEGACY_OBJECT_TYPE
  FROM UNNEST($1::TEXT[]) k
    ON CONFLICT
    DO NOTHING`,
			values: [keys, type],
		}, function (err) {
			if (err) {
				return callback(err);
			}

			db.query({
				name: 'ensureLegacyObjectsType2',
				text: `
SELECT "_key", "type"
  FROM "legacy_object_live"
 WHERE "_key" = ANY($1::TEXT[])`,
				values: [keys],
			}, function (err, res) {
				if (err) {
					return callback(err);
				}

				var invalid = res.rows.filter(function (r) {
					return r.type !== type;
				});

				if (invalid.length) {
					return callback(new Error('database: cannot insert multiple objects as ' + type + ' because they already exist: ' + invalid.map(function (r) {
						return JSON.stringify(r._key) + ' is ' + r.type;
					}).join(', ')));
				}

				var missing = keys.filter(function (k) {
					return !res.rows.some(function (r) {
						return r._key === k;
					});
				});

				if (missing.length) {
					return callback(new Error('database: failed to insert keys for objects: ' + JSON.stringify(missing)));
				}

				callback(null);
			});
		});
	});
};

helpers.noop = function () {};

module.exports = helpers;
