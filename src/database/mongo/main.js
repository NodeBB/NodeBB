"use strict";

var winston = require('winston');

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;

	module.flushdb = function(callback) {
		callback = callback || helpers.noop;
		db.dropDatabase(callback);
	};

	module.exists = function(key, callback) {
		if (!key) {
			return callback();
		}
		db.collection('objects').findOne({_key: key}, function(err, item) {
			callback(err, item !== undefined && item !== null);
		});
	};

	module.delete = function(key, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		db.collection('objects').remove({_key: key}, function(err, res) {
			callback(err);
		});
	};

	module.deleteAll = function(keys, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		db.collection('objects').remove({_key: {$in: keys}}, function(err, res) {
			callback(err);
		});
	};

	module.get = function(key, callback) {
		if (!key) {
			return callback();
		}
		module.getObjectField(key, 'value', callback);
	};

	module.set = function(key, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		var data = {value: value};
		module.setObject(key, data, callback);
	};

	module.increment = function(key, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		db.collection('objects').findAndModify({_key: key}, {}, {$inc: {value: 1}}, {new: true, upsert: true}, function(err, result) {
			callback(err, result && result.value ? result.value.value : null);
		});
	};

	module.rename = function(oldKey, newKey, callback) {
		callback = callback || helpers.noop;
		db.collection('objects').update({_key: oldKey}, {$set:{_key: newKey}}, {multi: true}, function(err, res) {
			callback(err);
		});
	};

	module.expire = function(key, seconds, callback) {
		module.expireAt(key, Math.round(Date.now() / 1000) + seconds, callback);
	};

	module.expireAt = function(key, timestamp, callback) {
		module.setObjectField(key, 'expireAt', new Date(timestamp * 1000), callback);
	};

	module.pexpire = function(key, ms, callback) {
		module.pexpireAt(key, Date.now() + parseInt(ms, 10), callback);
	};

	module.pexpireAt = function(key, timestamp, callback) {
		module.setObjectField(key, 'expireAt', new Date(timestamp), callback);
	};
};