

(function(module) {
	'use strict';
	var mongoClient = require('mongodb').MongoClient,
		winston = require('winston'),
		nconf = require('nconf'),
		express = require('express'),
		mongoStore = require('connect-mongo')(express),
		mongoHost = nconf.get('mongo:host'),
		db;

	module.init = function(callback) {
		mongoClient.connect('mongodb://'+ mongoHost + ':' + nconf.get('mongo:port') + '/' + nconf.get('mongo:database'), function(err, _db) {
			db = _db;
			console.log('WE ARE CONNECTED');

			if(err) {
				winston.error("NodeBB could not connect to your Mongo database. Mongo returned the following error: " + err.message);
				process.exit();
			}

			// TODO: fill out settings.db
			module.sessionStore = new mongoStore({
				db: db
			});


			db.createCollection('objects', function(err, collection) {
			});

			db.createCollection('sets', function(err, collection) {
			});


			callback(err);
		});
		// look up how its done in mongo
		/*if (nconf.get('mongo:password')) {
			redisClient.auth(nconf.get('mongo:password'));
		}
		*/
	}


	//
	// Exported functions
	//
	module.getFileName = function(callback) {
		throw new Error('not-implemented');
	}

	module.info = function(callback) {
		throw new Error('not-implemented');
	}

	// key

	module.exists = function(key, callback) {
		throw new Error('not-implemented');
	}

	module.delete = function(key, callback) {
		throw new Error('not-implemented');
	}

	module.get = function(key, callback) {
		throw new Error('not-implemented');
	}

	module.set = function(key, callback) {
		throw new Error('not-implemented');
	}

	module.keys = function(key, callback) {
		throw new Error('not-implemented');
	}

	//hashes

	module.setObject = function(key, data, callback) {
		data['_key'] = key;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, function(err, result) {
			callback(err, result);
		});
	}

	module.setObjectField = function(key, field, value, callback) {
		var data = {};
		data[field] = value;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, function(err, result) {
			callback(err, result);
		});
	}

	module.getObject = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, item) {
			if(item && item._id) {
				delete item._id;
			}
			callback(err, item);
		});
	}

	module.getObjectField = function(key, field, callback) {
		module.getObjectFields(key, [field], function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, data[field]);
		})
	}

	module.getObjectFields = function(key, fields, callback) {

		var _fields = {};
		for(var i=0; i<fields.length; ++i) {
			_fields[fields[i]] = 1;
		}

		db.collection('objects').findOne({_key:key}, {fields:_fields}, function(err, item) {
			if(err) {
				return callback(err);
			}

			var data = {};
			if(item === null) {
				for(var i=0; i<fields.length; ++i) {
					data[fields[i]] = null;
				}
				return callback(null, data);
			}

			if(item._id) {
				delete item._id;
			}
			callback(err, item);
		});
	}

	module.getObjectValues = function(key, callback) {
		module.getObject(key, function(err, data) {
			if(err) {
				return callback(err);
			}

			var values = [];
			for(var key in data) {
				values.push(data[key]);
			}
			callback(null, values);
		});
	}

	module.isObjectField = function(key, field, callback) {
		module.getObjectField(key, field, function(err, item) {
			callback(err, item !== undefined);
		});
	}

	module.deleteObjectField = function(key, field, callback) {
		var data = {};
		data[field] = "";
		db.collection('objects').update({_key:key}, {$unset : data}, function(err, result) {
			console.log(err, result);
			callback(err, result);
		});
	}

	module.incrObjectField = function(key, field, callback) {
		throw new Error('not-implemented');
	}

	module.decrObjectField = function(key, field, callback) {
		throw new Error('not-implemented');
	}

	module.incrObjectFieldBy = function(key, field, value, callback) {
		throw new Error('not-implemented');
	}


	// sets

	module.setAdd = function(key, value, callback) {
		throw new Error('not-implemented');
	}

	module.setRemove = function(key, value, callback) {
		throw new Error('not-implemented');
	}

	module.isSetMember = function(key, value, callback) {
		throw new Error('not-implemented');
	}

	module.isMemberOfSets = function(sets, value, callback) {
		throw new Error('not-implemented');
	}

	module.getSetMembers = function(key, callback) {
		console.log('GETTING SET MEMBERS', key);
		db.collection('sets').findOne({_key:key}, function(err, data) {
			if(err) {
				return callback(err);
			}

			if(!data) {
				console.log('GOT SET MEMBERS', []);
				callback(null, []);
			} else {
				console.log('GOT SET MEMBERS', data);
				callback(null, data);
			}
		});
	}

	module.setCount = function(key, callback) {
		throw new Error('not-implemented');
	}

	module.setRemoveRandom = function(key, callback) {
		throw new Error('not-implemented');
	}

	// sorted sets

	module.sortedSetAdd = function(key, score, value, callback) {
		throw new Error('not-implemented');
	}

	module.sortedSetRemove = function(key, value, callback) {
		throw new Error('not-implemented');
	}

	module.getSortedSetRange = function(key, start, stop, callback) {
		throw new Error('not-implemented');
	}

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		throw new Error('not-implemented');
	}

	module.getSortedSetRevRangeByScore = function(args, callback) {
		throw new Error('not-implemented');
	}

	module.sortedSetCount = function(key, min, max, callback) {
		throw new Error('not-implemented');
	}

	// lists
	module.listPrepend = function(key, value, callback) {
		throw new Error('not-implemented');
	}

	module.listAppend = function(key, value, callback) {
		throw new Error('not-implemented');
	}

	module.getListRange = function(key, start, stop, callback) {
		throw new Error('not-implemented');
	}


}(exports));

