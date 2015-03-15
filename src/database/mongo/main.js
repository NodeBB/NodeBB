"use strict";

var winston = require('winston');

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;

	module.searchIndex = function(key, data, id, callback) {
		callback = callback || function() {};
		var setData = {
			id: id,
			key: key
		};
		for(var field in data) {
			if (data.hasOwnProperty(field) && data[field]) {
				setData[field] = data[field].toString();
			}
		}

		db.collection('search').update({key: key, id: id}, {$set: setData}, {upsert:true, w: 1}, function(err) {
			if(err) {
				winston.error('Error indexing ' + err.message);
			}
			callback(err);
		});
	};

	module.search = function(key, data, limit, callback) {
		var searchQuery = {
			key: key
		};

		if (data.content) {
			searchQuery.$text = {$search: data.content};
		}

		if (data.cid) {
			searchQuery.cid = data.cid;
		}

		if (data.uid) {
			searchQuery.uid = data.uid;
		}

		db.collection('search').find(searchQuery, {limit: limit}).toArray(function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!results || !results.length) {
				return callback(null, []);
			}

			var data = results.map(function(item) {
				return item.id;
			});

			callback(null, data);
		});
	};

	module.searchRemove = function(key, id, callback) {
		callback = callback || helpers.noop;
		if (!id) {
			return callback();
		}
		db.collection('search').remove({key: key, id: id}, function(err, res) {
			callback(err);
		});
	};

	module.flushdb = function(callback) {
		callback = callback || helpers.noop;
		db.dropDatabase(callback);
	};

	module.info = function(callback) {
		db.stats({scale:1024}, function(err, stats) {
			if(err) {
				return callback(err);
			}

			stats.avgObjSize = (stats.avgObjSize / 1024).toFixed(2);
			stats.dataSize = (stats.dataSize / 1024).toFixed(2);
			stats.storageSize = (stats.storageSize / 1024).toFixed(2);
			stats.fileSize = (stats.fileSize / 1024).toFixed(2);
			stats.indexSize = (stats.indexSize / 1024).toFixed(2);
			stats.raw = JSON.stringify(stats, null, 4);
			stats.mongo = true;

			callback(null, stats);
		});
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
			callback(err, result ? result.value : null);
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