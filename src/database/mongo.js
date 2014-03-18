
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

	module.close = function() {
		db.close();
	};

	//
	// helper functions
	//
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

	function fieldToString(field) {
		if(field === null || field === undefined) {
			return field;
		}

		if(typeof field !== 'string') {
			field = field.toString();
		}
		// if there is a '.' in the field name it inserts subdocument in mongo, replace '.'s with \uff0E
		field = field.replace(/\./g, '\uff0E');
		return field;
	}

	function toString(value) {
		if(value === null || value === undefined) {
			return value;
		}

		return value.toString();
	}

	function done(cb) {
		return function(err, result) {
			if (typeof cb === 'function') {
				cb(err, result);
			}
		};
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
		db.collection('search').remove({id:id, key:key}, done(callback));
	};

	module.flushdb = function(callback) {
		db.dropDatabase(done(callback));
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

	// key

	module.exists = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, item) {
			callback(err, item !== undefined && item !== null);
		});
	};

	module.delete = function(key, callback) {
		db.collection('objects').remove({_key:key}, done(callback));
	};

	module.get = function(key, callback) {
		module.getObjectField(key, 'value', callback);
	};

	module.set = function(key, value, callback) {
		var data = {value:value};
		module.setObject(key, data, callback);
	};

	module.rename = function(oldKey, newKey, callback) {
		db.collection('objects').update({_key: oldKey}, {$set:{_key: newKey}}, done(callback));
	};

	module.expire = function(key, seconds, callback) {
		module.expireAt(key, Math.round(Date.now() / 1000) + seconds, callback);
	};

	module.expireAt = function(key, timestamp, callback) {
		module.setObjectField(key, 'expireAt', new Date(timestamp * 1000), callback);
	};

	//hashes
	module.setObject = function(key, data, callback) {
		data._key = key;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, done(callback));
	};

	module.setObjectField = function(key, field, value, callback) {
		var data = {};
		field = fieldToString(field);
		data[field] = value;
		module.setObject(key, data, callback);
	};

	module.getObject = function(key, callback) {
		db.collection('objects').findOne({_key:key}, {_id:0, _key:0}, callback);
	};

	module.getObjects = function(keys, callback) {

		db.collection('objects').find({_key:{$in:keys}}, {_id:0}).toArray(function(err, data) {

			if(err) {
				return callback(err);
			}

			var returnData = [];

			for(var i=0; i<keys.length; ++i) {
				returnData.push(findItem(data, keys[i]));
			}

			callback(null, returnData);
		});
	};

	module.getObjectField = function(key, field, callback) {
		field = fieldToString(field);
		module.getObjectFields(key, [field], function(err, data) {
			callback(err, data ? data[field] : null);
		});
	};

	module.getObjectFields = function(key, fields, callback) {
		module.getObjectsFields([key], fields, function(err, items) {
			callback(err, items ? items[0] : null);
		});
	};

	module.getObjectsFields = function(keys, fields, callback) {

		var _fields = {
			_id: 0,
			_key: 1
		};

		for(var i=0; i<fields.length; ++i) {
			fields[i] = fieldToString(fields[i]);
			_fields[fields[i]] = 1;
		}

		keys = keys.map(function(key) {
			return { _key : key};
		});

		db.collection('objects').find({$or: keys}, _fields).toArray(function(err, items) {
			if (err) {
				return callback(err);
			}

			if (items === null) {
				items = [];
			}

			var returnData = [],
				index = 0,
				item;

			for (var i=0; i<keys.length; ++i) {

				if (items[index] && items[index]._key === keys[i]._key) {
					item = items[index];
					index++;
				} else {
					item = {};
				}

				returnData.push(item);
				for (var k=0; k<fields.length; ++k) {
					if (item[fields[k]] === null || item[fields[k]] === undefined) {
						item[fields[k]] = null;
					}
				}
			}

			callback(null, returnData);
		});
	};

	module.getObjectKeys = function(key, callback) {
		module.getObject(key, function(err, data) {
			callback(err, data ? Object.keys(data) : []);
		});
	};

	module.getObjectValues = function(key, callback) {
		module.getObject(key, function(err, data) {
			if(err) {
				return callback(err);
			}

			var values = [];
			for(var key in data) {
				if (data && data.hasOwnProperty(key)) {
					values.push(data[key]);
				}
			}
			callback(null, values);
		});
	};

	module.isObjectField = function(key, field, callback) {
		var data = {};
		field = fieldToString(field);
		data[field] = '';
		db.collection('objects').findOne({_key:key}, {fields:data}, function(err, item) {
			callback(err, !!item && item[field] !== undefined && item[field] !== null);
		});
	};

	module.deleteObjectField = function(key, field, callback) {
		var data = {};
		field = fieldToString(field);
		data[field] = '';
		db.collection('objects').update({_key:key}, {$unset : data}, done(callback));
	};

	module.incrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	};

	module.decrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function(key, field, value, callback) {
		var data = {};
		field = fieldToString(field);
		data[field] = value;

		db.collection('objects').findAndModify({_key:key}, {}, {$inc: data}, {new:true, upsert:true}, function(err, result) {
			if(typeof callback === 'function') {
				callback(err, result ? result[field] : null);
			}
		});
	};


	// sets

	module.setAdd = function(key, value, callback) {
		if(!Array.isArray(value)) {
			value = [value];
		}

		value.forEach(function(element, index, array) {
			array[index] = toString(element);
		});

		db.collection('objects').update({
			_key: key
		}, {
			$addToSet: {
				members: {
					$each: value
				}
			}
		}, {
			upsert: true,
			w: 1
		}, done(callback));
	};

	module.setRemove = function(key, value, callback) {
		if(!Array.isArray(value)) {
			value = [value];
		}

		value.forEach(function(element, index, array) {
			array[index] = toString(element);
		});

		db.collection('objects').update({_key: key}, {$pullAll: {members: value}}, done(callback));
	};

	module.isSetMember = function(key, value, callback) {
		value = toString(value);

		db.collection('objects').findOne({_key:key, members: value}, function(err, item) {
			callback(err, item !== null && item !== undefined);
		});
	};

	module.isSetMembers = function(key, values, callback) {
		for (var i=0; i<values.length; ++i) {
			values[i] = toString(values[i]);
		}

		db.collection('objects').findOne({_key:key, members: {$in : values}}, function(err, items) {
			if (err) {
				return callback(err);
			}

			values = values.map(function(value) {
				return items.members.indexOf(value) !== -1;
			});

			callback(null, values);
		});
	};

	module.isMemberOfSets = function(sets, value, callback) {

		value = toString(value);

		db.collection('objects').find({_key: {$in : sets}, members: value}).toArray(function(err, result) {
			if(err) {
				return callback(err);
			}

			result = result.map(function(item) {
				return item._key;
			});

			result = sets.map(function(set) {
				return result.indexOf(set) !== -1 ? 1 : 0;
			});

			callback(null, result);
		});
	};

	module.getSetMembers = function(key, callback) {
		db.collection('objects').findOne({_key:key}, {members:1}, function(err, data) {
			callback(err, data ? data.members : []);
		});
	};

	module.setCount = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, data) {
			return callback(err, data ? data.members.length : 0);
		});
	};

	module.setRemoveRandom = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, data) {
			if(err || !data) {
				if(typeof callback === 'function') {
					callback(err, 0);
				}
				return;
			}

			var randomIndex = Math.floor(Math.random() * data.members.length);
			var value = data.members[randomIndex];
			module.setRemove(data._key, value, function(err, result) {
				if(typeof callback === 'function') {
					callback(err, value);
				}
			});
		});
	};


	// sorted sets

	module.sortedSetAdd = function(key, score, value, callback) {
		value = toString(value);
		var data = {
			score: parseInt(score, 10),
			value: value
		};

		db.collection('objects').update({_key:key, value:value}, {$set:data}, {upsert:true, w: 1}, done(callback));
	};

	module.sortedSetRemove = function(key, value, callback) {
		value = toString(value);

		db.collection('objects').remove({_key:key, value:value}, done(callback));
	};

	function getSortedSetRange(key, start, stop, sort, callback) {
		db.collection('objects').find({_key:key}, {fields:{value:1}})
			.limit(stop - start + 1)
			.skip(start)
			.sort({score: sort})
			.toArray(function(err, data) {
				if (err || !data) {
					return callback(err, null);
				}

				data = data.map(function(item) {
					return item.value;
				});

				callback(null, data);
			});
	}

	module.getSortedSetRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, 1, callback);
	};

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, callback);
	};

	module.getSortedSetRangeByScore = function(args, callback) {
		getSortedSetRangeByScore(args, 1, callback);
	};

	module.getSortedSetRevRangeByScore = function(args, callback) {
		getSortedSetRangeByScore(args, -1, callback);
	};

	function getSortedSetRangeByScore(args, sort, callback) {
		var key = args[0],
			max = (args[1] === '+inf') ? Number.MAX_VALUE : args[1],
			min = args[2],
			start = args[4],
			count = args[5];

		if(parseInt(count, 10) === -1) {
			count = 0;
		}

		db.collection('objects').find({_key:key, score: {$gte:min, $lte:max}}, {fields:{value:1}})
			.limit(count)
			.skip(start)
			.sort({score: sort})
			.toArray(function(err, data) {
				if(err) {
					return callback(err);
				}

				data = data.map(function(item) {
					return item.value;
				});

				callback(err, data);
			});
	}

	module.sortedSetCount = function(key, min, max, callback) {
		db.collection('objects').count({_key:key, score: {$gte:min, $lte:max}}, function(err, count) {
			callback(err, count ? count : 0);
		});
	};

	module.sortedSetCard = function(key, callback) {
		db.collection('objects').count({_key:key}, function(err, count) {
			callback(err, count ? count : 0);
		});
	};

	module.sortedSetRank = function(key, value, callback) {
		getSortedSetRank(module.getSortedSetRange, key, value, callback);
	};

	module.sortedSetRevRank = function(key, value, callback) {
		getSortedSetRank(module.getSortedSetRevRange, key, value, callback);
	};

	function getSortedSetRank(method, key, value, callback) {
		value = toString(value);
		method(key, 0, -1, function(err, result) {
			if(err) {
				return callback(err);
			}

			var rank = result.indexOf(value);
			callback(null, rank !== -1 ? rank : null);
		});
	}

	module.sortedSetScore = function(key, value, callback) {
		value = toString(value);
		db.collection('objects').findOne({_key:key, value: value}, {fields:{score:1}}, function(err, result) {
			callback(err, result ? result.score : null);
		});
	};

	module.isSortedSetMember = function(key, value, callback) {
		module.sortedSetScore(key, value, function(err, score) {
			callback(err, !!score);
		});
	};

	module.sortedSetsScore = function(keys, value, callback) {
		value = toString(value);
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
	};

	// lists
	module.listPrepend = function(key, value, callback) {
		value = toString(value);

		module.isObjectField(key, 'array', function(err, exists) {
			if(err) {
				if(typeof callback === 'function') {
					return callback(err);
				}
			}

			if(exists) {
				db.collection('objects').update({_key:key}, {'$set': {'array.-1': value}}, {upsert:true, w:1 }, done(callback));
			} else {
				module.listAppend(key, value, callback);
			}
		});
	};

	module.listAppend = function(key, value, callback) {
		value = toString(value);
		db.collection('objects').update({ _key: key }, { $push: { array: value } }, {upsert:true, w:1}, done(callback));
	};

	module.listRemoveLast = function(key, callback) {
		module.getListRange(key, -1, 0, function(err, value) {
			if(err) {
				if(typeof callback === 'function') {
					return callback(err);
				}
				return;
			}

			db.collection('objects').update({_key: key }, { $pop: { array: 1 } }, function(err, result) {
				if(typeof callback === 'function') {
					callback(err, (value && value.length) ? value[0] : null);
				}
			});
		});
	};

	module.listRemoveAll = function(key, value, callback) {
		value = toString(value);

		db.collection('objects').update({_key: key }, { $pull: { array: value } }, done(callback));
	};

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
			if(err || !(data && data.array)) {
				return callback(err, []);
			}

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
		});
	};

}(exports));

