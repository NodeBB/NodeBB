'use strict';

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	module.setObject = function (key, data, callback) {
		callback = callback || helpers.noop;

		if (!key || !data) {
			return callback();
		}

		if (data.hasOwnProperty('')) {
			delete data[''];
		}

		db.query({
			name: 'setObject',
			text: `SELECT "hash_setObject"($1::TEXT, $2::TEXT::JSONB)`,
			values: [key, JSON.stringify(data)],
		}, function (err) {
			callback(err);
		});
	};

	module.setObjectField = function (key, field, value, callback) {
		callback = callback || helpers.noop;

		if (!field) {
			return callback();
		}

		db.query({
			name: 'setObjectField',
			text: `SELECT "hash_setObject"($1::TEXT, JSONB_BUILD_OBJECT($2::TEXT, $3::TEXT::JSONB))`,
			values: [key, field, JSON.stringify(value)],
		}, function (err) {
			callback(err);
		});
	};

	module.getObject = function (key, callback) {
		if (!key) {
			return callback();
		}

		db.query({
			name: 'getObject',
			text: `SELECT "hash_getObject"($1::TEXT) "data"`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].data);
			}

			callback(null, null);
		});
	};

	module.getObjects = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}

		db.query({
			name: 'getObjects',
			text: `
SELECT "hash_getObject"("_key") "data"
  FROM UNNEST($1::TEXT[]) WITH ORDINALITY k("_key", i)
 ORDER BY i ASC`,
			values: [keys],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (row) {
				return row.data;
			}));
		});
	};

	module.getObjectField = function (key, field, callback) {
		if (!key) {
			return callback();
		}

		db.query({
			name: 'getObjectField',
			text: `SELECT "hash_getObject"($1::TEXT)->>$2::TEXT "f"`,
			values: [key, field],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].f);
			}

			callback(null, null);
		});
	};

	module.getObjectFields = function (key, fields, callback) {
		if (!key) {
			return callback();
		}

		db.query({
			name: 'getObjectFields',
			text: `SELECT "hash_filterObject"("hash_getObject"($1::TEXT), $2::TEXT[]) "d"`,
			values: [key, fields],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].d);
			}

			var obj = {};
			fields.forEach(function (f) {
				obj[f] = null;
			});

			callback(null, obj);
		});
	};

	module.getObjectsFields = function (keys, fields, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}

		db.query({
			name: 'getObjectsFields',
			text: `
SELECT "hash_filterObject"("hash_getObject"("_key"), $2::TEXT[]) "d"
  FROM UNNEST($1::TEXT[]) WITH ORDINALITY k("_key", i)
 ORDER BY i ASC`,
			values: [keys, fields],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (row) {
				return row.d;
			}));
		});
	};

	module.getObjectKeys = function (key, callback) {
		if (!key) {
			return callback();
		}

		db.query({
			name: 'getObjectKeys',
			text: `SELECT ARRAY(SELECT jsonb_object_keys("hash_getObject"($1::TEXT))) "k"`,
			values: [key],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].k);
			}

			callback(null, []);
		});
	};

	module.getObjectValues = function (key, callback) {
		module.getObject(key, function (err, data) {
			if (err) {
				return callback(err);
			}

			var values = [];

			if (data) {
				for (var key in data) {
					if (data.hasOwnProperty(key)) {
						values.push(data[key]);
					}
				}
			}

			callback(null, values);
		});
	};

	module.isObjectField = function (key, field, callback) {
		if (!key) {
			return callback();
		}

		db.query({
			name: 'isObjectField',
			text: `SELECT ("hash_getObject"($1::TEXT)->>$2::TEXT IS NOT NULL) "b"`,
			values: [key, field],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			if (res.rows.length) {
				return callback(null, res.rows[0].b);
			}

			callback(null, false);
		});
	};

	module.isObjectFields = function (key, fields, callback) {
		if (!key) {
			return callback();
		}

		module.getObjectFields(key, fields, function (err, data) {
			if (err) {
				return callback(err);
			}

			if (!data) {
				return callback(null, fields.map(function () {
					return false;
				}));
			}

			callback(null, fields.map(function (field) {
				return data.hasOwnProperty(field) && data[field] !== null;
			}));
		});
	};

	module.deleteObjectField = function (key, field, callback) {
		module.deleteObjectFields(key, [field], callback);
	};

	module.deleteObjectFields = function (key, fields, callback) {
		callback = callback || helpers.noop;
		if (!key || !Array.isArray(fields) || !fields.length) {
			return callback();
		}

		db.query({
			name: 'deleteObjectFields',
			text: `SELECT "hash_deleteObjectFields"($1::TEXT, $2::TEXT[])`,
			values: [key, fields],
		}, function (err) {
			callback(err);
		});
	};

	module.incrObjectField = function (key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	};

	module.decrObjectField = function (key, field, callback) {
		module.incrObjectFieldBy(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function (key, field, value, callback) {
		callback = callback || helpers.noop;
		value = parseInt(value, 10);

		if (!key || isNaN(value)) {
			return callback(null, null);
		}

		if (!Array.isArray(key)) {
			return module.incrObjectFieldBy([key], field, value, function (err, res) {
				callback(err, res && res[0]);
			});
		}

		db.query({
			name: 'incrObjectFieldByMulti',
			text: `
SELECT "hash_incrObjectField"("_key", $2::TEXT, $3::NUMERIC) "v"
  FROM UNNEST($1::TEXT[]) WITH ORDINALITY k("_key", i)
 ORDER BY i ASC`,
			values: [key, field, value],
		}, function (err, res) {
			if (err) {
				return callback(err);
			}

			callback(null, res.rows.map(function (r) {
				return parseFloat(r.v);
			}));
		});
	};
};
