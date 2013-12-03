

(function(module) {
	'use strict';
	var Db = require('mongodb').Db,
		mongoClient = require('mongodb').MongoClient,
		Server = require('mongodb').Server,
		winston = require('winston'),
		nconf = require('nconf'),
		express = require('express'),
		mongoStore = require('connect-mongo')(express),
		mongoHost = nconf.get('mongo:host'),
		db;


	var db = new Db(nconf.get('mongo:database'), new Server(mongoHost, nconf.get('mongo:port')), {w:1});
	//console.log(db.collection);

	db.open(function(err, _db) {
	//mongoClient.connect('mongodb://'+ mongoHost + ':' + nconf.get('mongo:port') + '/' + nconf.get('mongo:database'), function(err, _db) {
		console.log('WE ARE CONNECTED');
		if(err) {
			winston.error("NodeBB could not connect to your Mongo database. Mongo returned the following error: " + err.message);
			process.exit();
		}

		// TODO: fill out settings.db
		module.sessionStore = new mongoStore({
			db: db
		});

		db.collection('objects').findOne({_key:'config'}, {timeout:true}, function(err, item) {
			console.log('fail');
			console.log(item);
			callback(err, item);
		});

	});

	db.createCollection('objects', function(err, collection) {
		console.log('collection created', err, collection);
	});

	db.createCollection('sets', function(err, collection) {

	});


	// look up how its done in mongo
	/*if (nconf.get('mongo:password')) {
		redisClient.auth(nconf.get('mongo:password'));
	}
	*/


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

	//hashes

	module.setObject = function(key, data, callback) {
		data['_key'] = key;
		db.collection('objects').insert(data, {w:1}, function(err, result) {
			callback(err, result);
		});
	}

	module.setObjectField = function(key, field, value, callback) {
		db.collection('objects').update();
	}

	module.getObject = function(key, callback) {
		console.log('calling findOne');
		db.collection('objects').findOne({_key:key}, {timeout:true},function(err, item) {
			console.log(item);
			callback(err, item);
		});
	}

	module.getObjectField = function(key, field, callback) {
		throw new Error('not-implemented');
	}

	module.getObjectFields = function(key, fields, callback) {
		throw new Error('not-implemented');
	}

	module.getObjectValues = function(key, callback) {
		throw new Error('not-implemented');
	}

	module.isObjectField = function(key, field, callback) {
		throw new Error('not-implemented');
	}

	module.deleteObjectField = function(key, field, callback) {
		throw new Error('not-implemented');
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
		console.log('getting set members');
		db.collection('sets').findOne({_key:key}, function(err, data) {
			console.log('derp', err, data);
			callback(err, data);
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

