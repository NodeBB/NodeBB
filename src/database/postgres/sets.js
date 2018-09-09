'use strict';

var async = require('async');

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	module.setAdd = function (key, value, callback) {
		module.setsAdd([key], value, callback);
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

		db.query({
			name: 'setsAdd',
			text: `
SELECT "set_addMember"(k, m)
  FROM UNNEST($1::TEXT[]) k
 CROSS JOIN UNNEST($2::TEXT[]) m`,
			values: [keys, value],
		}, function (err) {
			callback(err);
		});
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
SELECT "set_removeMember"(k, m)
  FROM UNNEST($1::TEXT[]) k
 CROSS JOIN UNNEST($2::TEXT[]) m`,
			values: [key, value],
		}, function (err) {
			callback(err);
		});
	};

	module.setsRemove = function (keys, value, callback) {
		module.setRemove(keys, value, callback);
	};

	module.isSetMember = function (key, value, callback) {
		if (!key) {
			return callback(null, false);
		}

		db.query({
			name: 'isSetMember',
			text: `SELECT "set_isMember"($1::TEXT, $2::TEXT) "e"`,
			values: [key, value],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows[0].e);
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
SELECT "set_isMember"($1::TEXT, "member") "e"
  FROM UNNEST($2::TEXT[]) WITH ORDINALITY m("member", i)
 ORDER BY i ASC`,
			values: [key, values],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (r) {
				return r.e;
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
SELECT "set_isMember"("_key", $2::TEXT) "e"
  FROM UNNEST($1::TEXT[]) WITH ORDINALITY k("_key", i)
 ORDER BY i ASC`,
			values: [sets, value],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (r) {
				return r.e;
			}));
		});
	};

	module.getSetMembers = function (key, callback) {
		if (!key) {
			return callback(null, []);
		}

		db.query({
			name: 'getSetMembers',
			text: `SELECT "set_getMembers"($1::TEXT) "m"`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows[0].m || []);
		});
	};

	module.getSetsMembers = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}

		db.query({
			name: 'getSetsMembers',
			text: `
SELECT "set_getMembers"("_key") "m"
  FROM UNNEST($1::TEXT[]) WITH ORDINALITY k("_key", i)
 ORDER BY i ASC`,
			values: [keys],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (r) {
				return r.m;
			}));
		});
	};

	module.setCount = function (key, callback) {
		if (!key) {
			return callback(null, 0);
		}

		db.query({
			name: 'setCount',
			text: `SELECT COALESCE(ARRAY_LENGTH("set_getMembers"($1::TEXT), 1), 0) "c"`,
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
SELECT COALESCE(ARRAY_LENGTH("set_getMembers"("_key"), 1), 0) "c"
  FROM UNNEST($1::TEXT[]) WITH ORDINALITY k("_key", i)
 ORDER BY i ASC`,
			values: [keys],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (r) {
				return r.c;
			}));
		});
	};

	module.setRemoveRandom = function (key, callback) {
		callback = callback || helpers.noop;

		var member = null;

		module.transaction(function (tx, done) {
			async.waterfall([
				async.apply(module.getSetMembers, key),
				function (members, next) {
					if (members.length) {
						member = members[Math.floor(Math.random() * members.length)];
					}
					next(null, member);
				},
				async.apply(module.setRemove, key),
			], function (err) {
				done(err);
			});
		}, function (err) {
			callback(err, member);
		});
	};
};
