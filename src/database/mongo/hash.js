"use strict";

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;

	module.setObject = function(key, data, callback) {
		data._key = key;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, helpers.done(callback));
	};

	module.setObjectField = function(key, field, value, callback) {
		var data = {};
		field = helpers.fieldToString(field);
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
				returnData.push(helpers.findItem(data, keys[i]));
			}

			callback(null, returnData);
		});
	};

	module.getObjectField = function(key, field, callback) {
		field = helpers.fieldToString(field);
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
			fields[i] = helpers.fieldToString(fields[i]);
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
		field = helpers.fieldToString(field);
		data[field] = '';
		db.collection('objects').findOne({_key:key}, {fields:data}, function(err, item) {
			callback(err, !!item && item[field] !== undefined && item[field] !== null);
		});
	};

	module.deleteObjectField = function(key, field, callback) {
		var data = {};
		field = helpers.fieldToString(field);
		data[field] = '';
		db.collection('objects').update({_key:key}, {$unset : data}, helpers.done(callback));
	};

	module.incrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	};

	module.decrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function(key, field, value, callback) {
		var data = {};
		field = helpers.fieldToString(field);
		data[field] = value;

		db.collection('objects').findAndModify({_key:key}, {}, {$inc: data}, {new:true, upsert:true}, function(err, result) {
			if(typeof callback === 'function') {
				callback(err, result ? result[field] : null);
			}
		});
	};
};