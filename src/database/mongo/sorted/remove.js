'use strict';

module.exports = function (db, module) {
	var helpers = module.helpers.mongo;

	module.sortedSetRemove = function (key, value, callback) {
		function done(err) {
			callback(err);
		}
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		if (Array.isArray(key) && Array.isArray(value)) {
			db.collection('objects').remove({ _key: { $in: key }, value: { $in: value } }, done);
		} else if (Array.isArray(value)) {
			value = value.map(helpers.valueToString);
			db.collection('objects').remove({ _key: key, value: { $in: value } }, done);
		} else if (Array.isArray(key)) {
			value = helpers.valueToString(value);
			db.collection('objects').remove({ _key: { $in: key }, value: value }, done);
		} else {
			value = helpers.valueToString(value);
			db.collection('objects').remove({ _key: key, value: value }, done);
		}
	};

	module.sortedSetsRemove = function (keys, value, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		value = helpers.valueToString(value);

		db.collection('objects').remove({ _key: { $in: keys }, value: value }, function (err) {
			callback(err);
		});
	};

	module.sortedSetsRemoveRangeByScore = function (keys, min, max, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		var query = { _key: { $in: keys } };

		if (min !== '-inf') {
			query.score = { $gte: parseFloat(min) };
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = parseFloat(max);
		}

		db.collection('objects').remove(query, function (err) {
			callback(err);
		});
	};
};
