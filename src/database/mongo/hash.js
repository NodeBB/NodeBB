"use strict";

var winston = require('winston');

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;

	module.setObject = function(key, data, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		data._key = key;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, function(err) {
			callback(err);
		});
	};

	module.setObjectField = function(key, field, value, callback) {
		var data = {};
		field = helpers.fieldToString(field);
		data[field] = value;
		module.setObject(key, data, callback);
	};

	module.getObject = function(key, callback) {
		if (!key) {
			return callback();
		}
		db.collection('objects').findOne({_key: key}, {_id:0, _key:0}, callback);
	};

	module.getObjects = function(keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}
		db.collection('objects').find({_key: {$in: keys}}, {_id: 0}).toArray(function(err, data) {
			if(err) {
				return callback(err);
			}

			var map = helpers.toMap(data);
			var returnData = [];

			for(var i=0; i<keys.length; ++i) {
				returnData.push(map[keys[i]]);
			}

			callback(null, returnData);
		});
	};

	module.getObjectField = function(key, field, callback) {
		if (!key) {
			return callback();
		}
		field = helpers.fieldToString(field);
		var _fields = {
			_id: 0
		};
		_fields[field] = 1;
		db.collection('objects').findOne({_key: key}, _fields, function(err, item) {
			if (err || !item) {
				return callback(err, null);
			}

			callback(null, item[field] || null);
		});
	};

	module.getObjectFields = function(key, fields, callback) {
		if (!key) {
			return callback();
		}
		var _fields = {
			_id: 0
		};

		for(var i=0; i<fields.length; ++i) {
			fields[i] = helpers.fieldToString(fields[i]);
			_fields[fields[i]] = 1;
		}
		db.collection('objects').findOne({_key: key}, _fields, function(err, item) {
			if (err) {
				return callback(err);
			}
			item = item || {};
			var result = {};
			for(i=0; i<fields.length; ++i) {
				result[fields[i]] = item[fields[i]] || null;
			}
			callback(null, result);
		});
	};

	module.getObjectsFields = function(keys, fields, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}
		var _fields = {
			_id: 0,
			_key: 1
		};

		for(var i=0; i<fields.length; ++i) {
			fields[i] = helpers.fieldToString(fields[i]);
			_fields[fields[i]] = 1;
		}

		db.collection('objects').find({_key: {$in: keys}}, _fields).toArray(function(err, items) {
			if (err) {
				return callback(err);
			}

			if (items === null) {
				items = [];
			}

			var map = helpers.toMap(items);
			var returnData = [],
				index = 0,
				item;

			for (var i=0; i<keys.length; ++i) {
				item = map[keys[i]] || {};

				for (var k=0; k<fields.length; ++k) {
					if (item[fields[k]] === undefined) {
						item[fields[k]] = null;
					}
				}
				returnData.push(item);
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
		if (!key) {
			return callback();
		}
		var data = {};
		field = helpers.fieldToString(field);
		data[field] = '';
		db.collection('objects').findOne({_key: key}, {fields: data}, function(err, item) {
			callback(err, !!item && item[field] !== undefined && item[field] !== null);
		});
	};

	module.deleteObjectField = function(key, field, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		var data = {};
		field = helpers.fieldToString(field);
		data[field] = '';
		db.collection('objects').update({_key: key}, {$unset : data}, callback);
	};

	module.incrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	};

	module.decrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function(key, field, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		var data = {};
		field = helpers.fieldToString(field);
		data[field] = value;

		db.collection('objects').findAndModify({_key: key}, {}, {$inc: data}, {new:true, upsert:true}, function(err, result) {
			callback(err, result ? result[field] : null);
		});
	};
};