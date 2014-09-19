"use strict";

var winston = require('winston');

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;

	module.setAdd = function(key, value, callback) {
		callback = callback || helpers.noop;
		if(!Array.isArray(value)) {
			value = [value];
		}

		value.forEach(function(element, index, array) {
			array[index] = helpers.valueToString(element);
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
		}, function(err) {
			callback(err);
		});
	};

	module.setsAdd = function(keys, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		if(!Array.isArray(value)) {
			value = [value];
		}

		value.forEach(function(element, index, array) {
			array[index] = helpers.valueToString(element);
		});

		var bulk = db.collection('objects').initializeUnorderedBulkOp();

		for(var i=0; i<keys.length; ++i) {
			bulk.find({_key: keys[i]}).upsert().updateOne({	$addToSet: {
				members: {
					$each: value
				}
			}});
		}

		bulk.execute(function(err) {
			return callback(err);
		});
	};

	module.setRemove = function(key, value, callback) {
		callback = callback || helpers.noop;
		if(!Array.isArray(value)) {
			value = [value];
		}

		value.forEach(function(element, index, array) {
			array[index] = helpers.valueToString(element);
		});

		db.collection('objects').update({_key: key}, {$pullAll: {members: value}}, callback);
	};

	module.setsRemove = function(keys, value, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		value = helpers.valueToString(value);

		var bulk = db.collection('objects').initializeUnorderedBulkOp();

		for(var i=0; i<keys.length; ++i) {
			bulk.find({_key: keys[i]}).updateOne({$pull: {
				members: value
			}});
		}

		bulk.execute(function(err, res) {
			callback(err);
		});
	};


	module.isSetMember = function(key, value, callback) {
		value = helpers.valueToString(value);

		db.collection('objects').findOne({_key:key, members: value}, function(err, item) {
			callback(err, item !== null && item !== undefined);
		});
	};

	module.isSetMembers = function(key, values, callback) {
		for (var i=0; i<values.length; ++i) {
			values[i] = helpers.valueToString(values[i]);
		}

		db.collection('objects').findOne({_key:key, members: {$in : values}}, function(err, items) {
			if (err) {
				return callback(err);
			}

			values = values.map(function(value) {
				return !!(items && Array.isArray(items.members) && items.members.indexOf(value) !== -1);
			});

			callback(null, values);
		});
	};

	module.isMemberOfSets = function(sets, value, callback) {

		value = helpers.valueToString(value);

		db.collection('objects').find({_key: {$in : sets}, members: value}).toArray(function(err, result) {
			if(err) {
				return callback(err);
			}

			result = result.map(function(item) {
				return item._key;
			});

			result = sets.map(function(set) {
				return result.indexOf(set) !== -1;
			});

			callback(null, result);
		});
	};

	module.getSetMembers = function(key, callback) {
		db.collection('objects').findOne({_key:key}, {members:1}, function(err, data) {
			callback(err, data ? data.members : []);
		});
	};

	module.getSetsMembers = function(keys, callback) {
		db.collection('objects').find({_key: {$in: keys}}, {_key: 1, members: 1}).toArray(function(err, data) {
			if (err) {
				return callback(err);
			}
			var sets = {};
			data.forEach(function(set) {
				sets[set._key] = set.members || [];
			});

			var returnData = new Array(keys.length);
			for(var i=0; i<keys.length; ++i) {
				returnData[i] = sets[keys[i]] || [];
			}
			callback(null, returnData);
		});
	};

	module.setCount = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, data) {
			return callback(err, data ? data.members.length : 0);
		});
	};

	module.setRemoveRandom = function(key, callback) {
		callback = callback || function() {};
		db.collection('objects').findOne({_key:key}, function(err, data) {
			if(err || !data) {
				return callback(err);
			}

			var randomIndex = Math.floor(Math.random() * data.members.length);
			var value = data.members[randomIndex];
			module.setRemove(data._key, value, function(err) {
				callback(err, value);
			});
		});
	};
};