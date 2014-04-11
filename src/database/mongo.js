
'use strict';

(function(module) {

	var winston = require('winston'),
		async = require('async'),
		nconf = require('nconf'),
		express = require('express'),
		db,
		mongoClient,
		mongoStore;

	try {
		mongoClient = require('mongodb').MongoClient;
		mongoStore = require('connect-mongo')(express);
	} catch (err) {
		winston.error('Unable to initialize MongoDB! Is MongoDB installed? Error :' + err.message);
		process.exit();
	}


	module.init = function(callback) {
		mongoClient.connect('mongodb://'+ nconf.get('mongo:host') + ':' + nconf.get('mongo:port') + '/' + nconf.get('mongo:database'), function(err, _db) {
			if(err) {
				winston.error("NodeBB could not connect to your Mongo database. Mongo returned the following error: " + err.message);
				process.exit();
			}

			db = _db;

			module.client = db;

			module.sessionStore = new mongoStore({
				db: db
			});

			require('./mongo/main')(db, module);
			require('./mongo/hash')(db, module);
			require('./mongo/sets')(db, module);
			require('./mongo/sorted')(db, module);
			require('./mongo/list')(db, module);

			if(nconf.get('mongo:password') && nconf.get('mongo:username')) {
				db.authenticate(nconf.get('mongo:username'), nconf.get('mongo:password'), function (err) {
					if(err) {
						winston.error(err.message);
						process.exit();
					}
					createIndices();
				});
			} else {
				winston.warn('You have no mongo password setup!');
				createIndices();
			}

			function createIndices() {
				db.collection('objects').ensureIndex({_key :1}, {background:true}, function(err) {
					if(err) {
						winston.error('Error creating index ' + err.message);
					}
				});

				db.collection('objects').ensureIndex({'expireAt':1}, {expireAfterSeconds:0, background:true}, function(err) {
					if(err) {
						winston.error('Error creating index ' + err.message);
					}
				});

				db.collection('search').ensureIndex({content:'text'}, {background:true}, function(err) {
					if(err) {
						winston.error('Error creating index ' + err.message);
					}
				});

				if(typeof callback === 'function') {
					callback();
				}
			}
		});
	};

	var helpers = {};
	helpers.findItem = function(data, key) {
		if(!data) {
			return null;
		}

		for(var i=0; i<data.length; ++i) {
			if(data[i]._key === key) {
				var item = data.splice(i, 1);
				if(item && item.length) {
					return item[0];
				} else {
					return null;
				}
			}
		}
		return null;
	};

	helpers.fieldToString = function(field) {
		if(field === null || field === undefined) {
			return field;
		}

		if(typeof field !== 'string') {
			field = field.toString();
		}
		// if there is a '.' in the field name it inserts subdocument in mongo, replace '.'s with \uff0E
		field = field.replace(/\./g, '\uff0E');
		return field;
	};

	helpers.valueToString = function(value) {
		if(value === null || value === undefined) {
			return value;
		}

		return value.toString();
	};

	helpers.done = function(cb) {
		return function(err, result) {
			if (typeof cb === 'function') {
				cb(err, result);
			}
		};
	};

	module.helpers = module.helpers || {};
	module.helpers.mongo = helpers;
}(exports));

