"use strict";

var winston = require('winston');

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;


	module.searchIndex = function(key, content, id) {
		var data = {
			id:id,
			key:key,
			content:content
		};

		db.collection('search').update({id:id, key:key}, {$set:data}, {upsert:true, w: 1}, function(err, result) {
			if(err) {
				winston.error('Error indexing ' + err.message);
			}
		});
	};

	module.search = function(key, term, limit, callback) {
		db.command({text:'search' , search: term, filter: {key:key}, limit: limit }, function(err, result) {
			if(err) {
				return callback(err);
			}

			if(!result || !result.results || !result.results.length) {
				return callback(null, []);
			}

			var data = result.results.map(function(item) {
				return item.obj.id;
			});

			callback(null, data);
		});
	};

	module.searchRemove = function(key, id, callback) {
		db.collection('search').remove({id:id, key:key}, helpers.done(callback));
	};

	module.flushdb = function(callback) {
		db.dropDatabase(helpers.done(callback));
	};

	module.info = function(callback) {
		db.stats({scale:1024}, function(err, stats) {
			if(err) {
				return callback(err);
			}

			stats.avgObjSize = (stats.avgObjSize / 1024).toFixed(2);
			stats.raw = JSON.stringify(stats, null, 4);
			stats.mongo = true;

			callback(null, stats);
		});
	};

	module.exists = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, item) {
			callback(err, item !== undefined && item !== null);
		});
	};

	module.delete = function(key, callback) {
		db.collection('objects').remove({_key:key}, helpers.done(callback));
	};

	module.get = function(key, callback) {
		module.getObjectField(key, 'value', callback);
	};

	module.set = function(key, value, callback) {
		var data = {value:value};
		module.setObject(key, data, callback);
	};

	module.rename = function(oldKey, newKey, callback) {
		db.collection('objects').update({_key: oldKey}, {$set:{_key: newKey}}, helpers.done(callback));
	};

	module.expire = function(key, seconds, callback) {
		module.expireAt(key, Math.round(Date.now() / 1000) + seconds, callback);
	};

	module.expireAt = function(key, timestamp, callback) {
		module.setObjectField(key, 'expireAt', new Date(timestamp * 1000), callback);
	};

	module.pexpire = function(key, ms, callback) {
		module.expireAt(key, Date.now() + parseInt(ms, 10), callback);
	};

	module.pexpireAt = function(key, timestamp, callback) {
		module.setObjectField(key, 'expireAt', new Date(timestamp), callback);
	};
};