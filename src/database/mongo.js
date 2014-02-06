

(function(module) {
	'use strict';
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


			if(nconf.get('mongo:password') && nconf.get('mongo:username')) {
				db.authenticate(nconf.get('mongo:username'), nconf.get('mongo:password'), function (err) {
					if(err) {
						winston.error(err.message);
						process.exit();
					}
					createIndices();
				});
			} else {
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

				callback(null);
			}
		});
	}

	//
	// helper functions
	//
	function removeHiddenFields(item) {
		if(item) {
			if(item._id) {
				delete item._id;
			}
			if(item._key) {
				delete item._key;
			}
		}
		return item;
	}

	function findItem(data, key) {
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
	}


	//
	// Exported functions
	//

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
	}

	module.search = function(key, term, limit, callback) {
		db.command({text:"search" , search: term, filter: {key:key}, limit: limit }, function(err, result) {
			if(err) {
				return callback(err);
			}

			if(!result) {
				return callback(null, []);
			}

			if(result.results && result.results.length) {
				var data = result.results.map(function(item) {
					return item.obj.id;
				});
				callback(null, data);
			} else {
				callback(null, []);
			}
		});
	}

	module.searchRemove = function(key, id, callback) {
		db.collection('search').remove({id:id, key:key}, function(err, result) {
			if(err) {
				winston.error('Error removing search ' + err.message);
			}
      if (typeof callback === 'function') {
        callback()
      }
		});
	}

	module.flushdb = function(callback) {
		db.dropDatabase(function(err, result) {
			if(err){
				winston.error(error);
				if(callback) {
					return callback(err);
				}
			}

			if(callback) {
				callback(null);
			}
		});
	}


	module.getFileName = function(callback) {
		throw new Error('not-implemented');
	}

	module.info = function(callback) {
		db.stats({scale:1024}, function(err, stats) {

			// TODO : if this it not deleted the templates break,
			// it is a nested object inside stats
			delete stats.dataFileVersion;

			stats.avgObjSize = (stats.avgObjSize / 1024).toFixed(2);

			stats.raw = JSON.stringify(stats, null, 4);

			stats.mongo = true;

			callback(err, stats);

		});
	}

	// key

	module.exists = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, item) {
			callback(err, item !== undefined && item !== null);
		});
	}

	module.delete = function(key, callback) {
		db.collection('objects').remove({_key:key}, function(err, result) {
			if(err) {
				if(callback) {
					return callback(err);
				} else {
					return winston.error(err.message);
				}
			}

			if(callback) {
				callback(null, result);
			}
		});
	}

	module.get = function(key, callback) {
		module.getObjectField(key, 'value', callback);
	}

	module.set = function(key, value, callback) {
		var data = {value:value};
		module.setObject(key, data, callback);
	}

	module.keys = function(key, callback) {
		db.collection('objects').find( { _key: { $regex: key /*, $options: 'i'*/ } }, function(err, result) {
			callback(err, result);
		});
	}

	module.rename = function(oldKey, newKey, callback) {
		db.collection('objects').update({_key: oldKey}, {$set:{_key: newKey}}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.expire = function(key, seconds, callback) {
		module.expireAt(key, Math.round(Date.now() / 1000) + seconds, callback);
	}

	module.expireAt = function(key, timestamp, callback) {
		module.setObjectField(key, 'expireAt', new Date(timestamp * 1000), callback);
	}

	//hashes
	module.setObject = function(key, data, callback) {
		data['_key'] = key;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.setObjectField = function(key, field, value, callback) {
		var data = {};
		// if there is a '.' in the field name it inserts subdocument in mongo, replace '.'s with \uff0E
		if(typeof field !== 'string') {
			field = field.toString();
		}
		field = field.replace(/\./g, '\uff0E');
		data[field] = value;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.getObject = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, item) {
			removeHiddenFields(item);

			callback(err, item);
		});
	}

	module.getObjects = function(keys, callback) {

		db.collection('objects').find({_key:{$in:keys}}, {_id:0}).toArray(function(err, data) {

			if(err) {
				return callback(err);
			}

			var returnData = [];

			for(var i=0; i<keys.length; ++i) {
				returnData.push(findItem(data, keys[i]));
			}

			callback(err, returnData);
		});
	}

	module.getObjectField = function(key, field, callback) {
		module.getObjectFields(key, [field], function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, data[field]);
		});
	}

	module.getObjectFields = function(key, fields, callback) {

		var _fields = {};
		for(var i=0; i<fields.length; ++i) {
			if(typeof fields[i] !== 'string') {
				_fields[fields[i].toString().replace(/\./g, '\uff0E')] = 1;
			} else {
				_fields[fields[i].replace(/\./g, '\uff0E')] = 1;
			}
		}

		db.collection('objects').findOne({_key:key}, _fields, function(err, item) {

			if(err) {
				return callback(err);
			}

			if(item === null) {
				item = {};
			}

			for(var i=0; i<fields.length; ++i) {
				if(item[fields[i]] === null || item[fields[i]] === undefined) {
					item[fields[i]] = null;
				}
			}

			removeHiddenFields(item);

			callback(err, item);
		});
	}

	module.getObjectKeys = function(key, callback) {
		module.getObject(key, function(err, data) {
			if(err) {
				return callback(err);
			}

			if(data) {
				callback(null, Object.keys(data));
			} else {
				callback(null, []);
			}
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
		var data = {};
		if(typeof field !== 'string') {
			field = field.toString();
		}
		field = field.replace(/\./g, '\uff0E');
		data[field] = '';
		db.collection('objects').findOne({_key:key}, {fields:data}, function(err, item) {
			if(err) {
				return callback(err);
			}
			callback(err, !!item && item[field] !== undefined && item[field] !== null);
		});
	}

	module.deleteObjectField = function(key, field, callback) {
		var data = {};
		if(typeof field !== 'string') {
			field = field.toString();
		}
		field = field.replace(/\./g, '\uff0E');
		data[field] = "";
		db.collection('objects').update({_key:key}, {$unset : data}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.incrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	}

	module.decrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, -1, callback);
	}

	module.incrObjectFieldBy = function(key, field, value, callback) {
		var data = {};
		if(typeof field !== 'string') {
			field = field.toString();
		}
		field = field.replace(/\./g, '\uff0E');
		data[field] = value;

		db.collection('objects').findAndModify({_key:key}, {}, {$inc: data}, {new:true, upsert:true}, function(err, result) {
			if(callback) {
				callback(err, result ? result[field] : null);
			}
		});
	}


	// sets

	module.setAdd = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		db.collection('objects').update({_key:key}, {$addToSet: { members: value }}, {upsert:true, w: 1},  function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.setRemove = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		db.collection('objects').update({_key:key, members: value}, {$pull : {members: value}}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.isSetMember = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		db.collection('objects').findOne({_key:key, members: value}, function(err, item) {
			callback(err, item !== null && item !== undefined);
		});
	}

	module.isMemberOfSets = function(sets, value, callback) {
		function iterator(set, next) {
			module.isSetMember(set, value, function(err, result) {
				if(err) {
					return next(err);
				}

				next(null, result?1:0);
			});
		}

		async.map(sets, iterator, function(err, result) {
			callback(err, result);
		});

	}

	module.getSetMembers = function(key, callback) {
		db.collection('objects').findOne({_key:key}, {members:1}, function(err, data) {
			if(err) {
				return callback(err);
			}

			if(!data) {
				callback(null, []);
			} else {
				callback(null, data.members);
			}
		});
	}

	module.setCount = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, data) {
			if(err) {
				return callback(err);
			}
			if(!data) {
				return callback(null, 0);
			}

			callback(null, data.members.length);
		});
	}

	module.setRemoveRandom = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, data) {
			if(err) {
				if(callback) {
					return callback(err);
				} else {
					return winston.error(err.message);
				}
			}

			if(!data) {
				if(callback) {
					callback(null, 0);
				}
			} else {
				var randomIndex = Math.floor(Math.random() * data.members.length);
				var value = data.members[randomIndex];
				module.setRemove(data._key, value, function(err, result) {
					if(callback) {
						callback(err, value);
					}
				});
			}
		});
	}


	// sorted sets

	module.sortedSetAdd = function(key, score, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		var data = {
			score:score,
			value:value
		};

		db.collection('objects').update({_key:key, value:value}, {$set:data}, {upsert:true, w: 1}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.sortedSetRemove = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		db.collection('objects').remove({_key:key, value:value}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	function getSortedSetRange(key, start, stop, sort, callback) {
		db.collection('objects').find({_key:key}, {fields:{value:1}})
			.limit(stop - start + 1)
			.skip(start)
			.sort({score: sort})
			.toArray(function(err, data) {
				if(err) {
					return callback(err);
				}

				// maybe this can be done with mongo?
				data = data.map(function(item) {
					return item.value;
				});

				callback(err, data);
			});
	}

	module.getSortedSetRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, 1, callback);
	}

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, callback);
	}

	module.getSortedSetRevRangeByScore = function(args, callback) {

		//var args = ['topics:recent', '+inf', timestamp - since, 'LIMIT', start, end - start + 1];
		var key = args[0],
			max = (args[1] === '+inf')?Number.MAX_VALUE:args[1],
			min = args[2],
			start = args[4],
			stop = args[5];


		db.collection('objects').find({_key:key, score: {$gte:min, $lte:max}}, {fields:{value:1}})
			.limit(stop - start + 1)
			.skip(start)
			.sort({score: -1})
			.toArray(function(err, data) {
				if(err) {
					return callback(err);
				}

				// maybe this can be done with mongo?
				data = data.map(function(item) {
					return item.value;
				});

				callback(err, data);
			});
	}

	module.sortedSetCount = function(key, min, max, callback) {
		db.collection('objects').count({_key:key, score: {$gte:min, $lte:max}}, function(err, count) {
			if(err) {
				return callback(err);
			}

			if(!count) {
				return callback(null, 0);
			}
			callback(null,count);
		});
	}

	module.sortedSetCard = function(key, callback) {
		db.collection('objects').count({_key:key}, function(err, count) {
			if(err) {
				return callback(err);
			}

			if(!count) {
				return callback(null, 0);
			}
			callback(null, count);
		});
	}

	module.sortedSetRank = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		module.getSortedSetRange(key, 0, -1, function(err, result) {
			if(err) {
				return callback(err);
			}
			var rank = result.indexOf(value);
			if(rank === -1) {
				return callback(null, null);
			}

			callback(null, rank);
		});
	}

	module.sortedSetRevRank = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		module.getSortedSetRange(key, 0, -1, function(err, result) {
			if(err) {
				return callback(err);
			}
			var rank = result.indexOf(value);
			if(rank === -1) {
				return callback(null, null);
			}

			callback(null, result.length - rank - 1);
		});
	}

	module.sortedSetScore = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		db.collection('objects').findOne({_key:key, value: value}, {fields:{score:1}}, function(err, result) {
			if(err) {
				return callback(err);
			}
			if(result) {
				return callback(null, result.score);
			}

			callback(err, null);
		});
	}

	module.sortedSetsScore = function(keys, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		db.collection('objects').find({_key:{$in:keys}, value: value}).toArray(function(err, result) {
			if(err) {
				return callback(err);
			}

			var returnData = [],
				item;

			for(var i=0; i<keys.length; ++i) {
				item = findItem(result, keys[i]);
				returnData.push(item ? item.score : null);
			}

			callback(null, returnData);
		});
	}

	// lists
	module.listPrepend = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		module.isObjectField(key, 'array', function(err, exists) {
			if(err) {
				if(callback) {
					return callback(err);
				} else {
					return winston.error(err.message);
				}
			}

			if(exists) {
 				db.collection('objects').update({_key:key}, {'$set': {'array.-1': value}}, {upsert:true, w:1 }, function(err, result) {
					if(callback) {
						callback(err, result);
					}
	 			});
 			} else {
 				module.listAppend(key, value, callback);
 			}

 		})
	}

	module.listAppend = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		db.collection('objects').update({ _key: key }, { $push: { array: value } }, {upsert:true, w:1}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.listRemoveLast = function(key, callback) {
		module.getListRange(key, -1, 0, function(err, value) {
			if(err) {
				return callback(err);
			}

			db.collection('objects').update({_key: key }, { $pop: { array: 1 } }, function(err, result) {
				if(err) {
					if(callback) {
						return callback(err);
					}
					return;
				}

				if(value && value.length) {
					if(callback) {
						callback(err, value[0]);
					}
				} else {
					if(callback) {
						callback(err, null);
					}
				}
			});
		});
	}

	module.listRemoveAll = function(key, value, callback) {
		if(value !== null && value !== undefined) {
			value = value.toString();
		}
		db.collection('objects').update({_key: key }, { $pull: { array: value } }, function(err, result) {
			if(err) {
				if(callback) {
					return callback(err);
				}
				return;
			}

			if(callback) {
				callback(null, result);
			}
		});
	}

	module.getListRange = function(key, start, stop, callback) {

		var skip = start,
			limit = stop - start + 1,
			splice = false;

		if((start < 0 && stop >= 0) || (start >= 0 && stop < 0)) {
			skip = 0;
			limit = Math.pow(2, 31) - 2;
			splice = true;
		} else if (start > stop) {
			return callback(null, []);
		}

		db.collection('objects').findOne({_key:key}, { array: { $slice: [skip, limit] }}, function(err, data) {
			if(err) {
				return callback(err);
			}

			if(data && data.array) {
				if(splice) {

					if(start < 0) {
						start = data.array.length - Math.abs(start);
					}

					if(stop < 0) {
						stop = data.array.length - Math.abs(stop);
					}

					if(start > stop) {
						return callback(null, []);
					}

					var howMany = stop - start + 1;
					if(start !== 0 || howMany !== data.array.length) {
						data.array = data.array.splice(start, howMany);
					}
				}

				callback(null, data.array);
			} else {
				callback(null, []);
			}
		});
	}


}(exports));

