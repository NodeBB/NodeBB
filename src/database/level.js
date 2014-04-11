'use strict';

(function(module) {
	/*
	* Okay, so LevelDB was made by Google. Therefore it's skalable.
	* BUT, I created 99% of the rest of NodeBB's expected functionality out of just simple get and set commands.
	* Therefore, it is unskalable. I totally should have read the docs before starting.
	*
	* With much <3, psychobunny.
	*/


	var winston = require('winston'),
		nconf = require('nconf'),
		path = require('path'),
		async = require('async'),
		express = require('express'),
		utils = require('./../../public/src/utils.js'),
		levelup,
		leveldown,
		connectLevel,
		db, ld;

	try {
		levelup = require('levelup');
		leveldown = require('leveldown');
		connectLevel = require('connect-leveldb')(express);
	} catch (err) {
		winston.error('Unable to initialize Level DB! Is Level DB installed? Error :' + err.message);
		process.exit();
	}

	module.init = function(callback) {
		if (db) {
			if(typeof callback === 'function') {
				callback();
			}

			return;
		} 

		db = levelup(nconf.get('level:database'), {
			valueEncoding: 'json'
		});

		ld = leveldown(nconf.get('level:database'));

		db.on('error', function (err) {
			winston.error(err.message);
			process.exit();
		});

		module.client = db;

		module.sessionStore = new connectLevel({
			db: db,
			ttl: 60 * 60 * 24 * 14
		});

		if(typeof callback === 'function') {
			callback();
		}
	};

	module.close = function(callback) {
		db.close(callback);
	};

	//
	// Exported functions
	//
	module.searchIndex = function(key, content, id) {
		// o.O
	};

	module.search = function(key, term, limit, callback) {
		// O.o	
	};

	module.searchRemove = function(key, id, callback) {
		// o___O
	};

	module.flushdb = function(callback) {
		db.close(function() {
			leveldown.destroy(nconf.get('level:database'), function() {
				db.open(callback);
			});	
		});
	};

	module.info = function(callback) {
		// O____O      GIEF FOOD
		//  v v
	};

	// key

	module.exists = function(key, callback) {
		db.get(key, function(err, value) {
			callback(null, !!value);
		});
	};

	module.delete = function(key, callback) {
		db.del(key, callback);
	};

	module.get = function(key, callback) {
		db.get(key, function(err, value) {
			callback(false, value);
		});
	};

	module.set = function(key, value, callback, sync) {
		if (value === '') {
			callback(false);
		} else {
			var options = {
				sync: typeof sync !== 'undefined'
			};

			db.put(key, value, options, function(err) {
				// uh, err is {}.. why??
				if (typeof callback === 'function') {
					callback(null);
				}
			});
		}
	};

	module.rename = function(oldKey, newKey, callback) {
		// G__G
	};

	module.expire = function(key, seconds, callback) {
		// >__>
	};

	module.expireAt = function(key, timestamp, callback) {
		// <__<
	};

	//hashes

	module.setObject = function(key, obj, callback) {
		async.parallel([
			function(next) {
				async.each(Object.keys(obj), function(objKey, next) {
					module.setObjectField(key, objKey, obj[objKey], next);
				}, next);
			},
			function(next) {
				module.set(key, Object.keys(obj).join('-ldb-'));
				next();
			}
		], function(err) {
			if (typeof callback === 'function') {
				callback(err, obj);
			}
		});
	};

	module.setObjectField = function(key, field, value, callback) {
		module.set(key + ':' + field, value, callback);
	};

	module.getObject = function(key, callback) {
		var obj = {};

		module.getObjectKeys(key, function(err, keys) {
			if (keys) {
				keys = keys.split('-ldb-');
				async.each(keys, function(field, next) {
					module.getObjectField(key, field, function(err, value) {
						obj[field] = value;
						next(err);
					});
				}, function(err) {
					if (typeof callback === 'function') {
						callback(err, obj);
					}
				});	
			} else {
				if (typeof callback === 'function') {
					callback(err, {});
				}
			}
		});
	};

	module.getObjects = function(keys, callback) {
		var arr = [];

		async.each(keys, function(key, next) {
			module.getObject(key, function(err, val) {
				arr.push(val);
				next();
			});
		}, function(err) {
			callback(err, arr);
		});
	};

	module.getObjectField = function(key, field, callback) {
		module.get(key + ':' + field, function(err, val) {
			callback(err, typeof val !== 'undefined' ? val : '');
		});
	};

	module.getObjectFields = function(key, fields, callback) {
		// can be improved with multi.
		var obj = {};
		async.each(fields, function(field, next) {
			module.getObjectField(key, field, function(err, value) {
				obj[field] = value;
				next();
			});
		}, function(err) {
			callback(err, obj);
		});
	};

	module.getObjectsFields = function(keys, fields, callback) {
		var arr = [];

		async.each(keys, function(key, next) {
			module.getObjectFields(key, fields, function(err, obj) {
				arr.push(obj);
				next();
			});
		}, function(err) {
			callback(err, arr);
		});
	};

	module.getObjectKeys = function(key, callback) {
		module.get(key, callback);
	};

	module.getObjectValues = function(key, callback) {
		module.getObject(key, function(err, obj) {
			var values = [];
			for (var key in obj) {
				if (obj.hasOwnProperty(key)) {
					values.push(obj[key]);
				}
			}

			callback(err, values);
		});
	};

	module.isObjectField = function(key, field, callback) {
		module.get(key + ':' + field, function(err, val) {
			callback(err, !!val);
		});
	};

	module.deleteObjectField = function(key, field, callback) {
		module.delete(key + ':' + field, callback);
	};

	module.incrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	};

	module.decrObjectField = function(key, field, callback) {
		module.decrObjectFieldBy(key, field, 1, callback);
	};

	module.incrObjectFieldBy = function(key, field, value, callback) {
		module.get(key + ':' + field, function(err, val) {
			val = val ? (val + value) : value;
			module.set(key + ':' + field, val, function(err) {
				if (typeof callback === 'function') {
					callback(err, val);
				}
			});
		});
	};

	module.decrObjectFieldBy = function(key, field, value, callback) {
		module.get(key + ':' + field, function(err, val) {
			val = val ? (val - value) : -value;
			module.set(key + ':' + field, val, function(err) {
				if (typeof callback === 'function') {
					callback(err, val);
				}
			});
		});
	};

	// sets

	module.setAdd = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, set) {
			if (set.indexOf(value) === -1) {
				module.listAppend(key, value, callback);
			} else {
				if (typeof callback === 'function') {
					callback(null, []); // verify if it sends back true on redis?
				}
			}
		});
	};

	module.setRemove = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, set) {
			module.set(key, set.splice(set.indexOf(value), 1), callback);
		});
	};

	module.isSetMember = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, set) {
			callback(err, set.indexOf(value) !== -1);
		});
	};

	module.isSetMembers = function(key, values, callback) {
		var members = {};

		async.each(values, function(value, next) {
			module.isSetMember(key, value, function(err, isMember) {
				members[key] = isMember;
			});
		}, function(err) {
			callback(err, members);
		});
	};

	module.isMemberOfSets = function(sets, value, callback) {
		// can be improved
		var members = [];

		async.each(sets, function(set, next) {
			module.isSetMember(set, value, function(err, isMember) {
				members.push(value);
				next();
			});
		}, function(err) {
			callback(err, members);
		});
	};

	module.getSetMembers = function(key, callback) {
		module.getListRange(key, 0, -1, function(err, set) {
			callback(err, set);
		});
	};

	module.setCount = function(key, callback) {
		module.getListRange(key, 0, -1, function(err, set) {
			callback(err, set.length);
		});
	};

	module.setRemoveRandom = function(key, callback) {
		// how random is this? well, how random are the other implementations of this?
		// imo rename this to setRemoveOne

		module.getListRange(key, 1, -1, function(err, set) {
			module.set(key, set, callback);
		});
	};

	// sorted sets

	module.sortedSetAdd = function(key, score, value, callback) {
		module.getListRange(key, 0, -1, function(err, set) {
			set = set.filter(function(a) {return a.value !== value.toString();});

			set.push({
				value: value.toString(),
				score: parseInt(score, 10)
			});

			set.sort(function(a, b) {return a.score - b.score;});
			module.set(key, set, callback);
		});
	};

	module.sortedSetRemove = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, set) {
			set = set.filter(function(a) {return a.value !== value.toString();});
			module.set(key, set, callback);
		});
	};

	function flattenSortedSet(set, callback) {
		/*callback(null, !set.length ? [] : set.reduce(function(a, b) {
			return (a.length ? a : [a.value, a.score]).concat([b.value, b.score]);
		}));*/
		callback(null, !set.length ? [] : set.reduce(function(a, b) {
			return (a.length ? a : [a.value]).concat([b.value]);
		}));
	}

	module.getSortedSetRange = function(key, start, stop, callback) {
		module.getListRange(key, start, stop, function(err, set) {
			set = !set.length ? [] : set.reduce(function(a, b) {
				return (a.length ? a : [a.value]).concat(b.value);
			});
			if (set.value) {
				set = [set.value];
			}
			callback(err, set);
		});
	};

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		module.getListRange(key, start, stop, function(err, set) {
			set = !set.length ? [] : set.reverse().reduce(function(a, b) {
				return (a.length ? a : [a.value]).concat(b.value);
			});
			if (set.value) {
				set = [set.value];
			}
			callback(err, set);
		});
	};

	module.getSortedSetRangeByScore = function(args, callback) {
		var key = args[0],
			max = (args[1] === '+inf') ? Number.MAX_VALUE : args[1],
			min = (args[2] === '-inf') ? Number.MIN_VALUE : args[2],
			start = args[4],
			count = args[5];


		module.getListRange(key, 0, -1, function(err, list) {
			list.filter(function(a) {
				return a.score >= min && a.score <= max; // to check: greater or and equal?
			});

			flattenSortedSet(list.slice(start ? start : 0, count ? count : list.length), callback);
		});
	};

	module.getSortedSetRevRangeByScore = function(args, callback) {
		var key = args[0],
			max = (args[1] === '+inf') ? Number.MAX_VALUE : args[1],
			min = (args[2] === '-inf') ? Number.MIN_VALUE : args[2],
			start = args[4],
			count = args[5];


		module.getListRange(key, 0, -1, function(err, list) {
			list.filter(function(a) {
				return a.score >= min && a.score <= max; // to check: greater or and equal?
			});

			flattenSortedSet(list.slice(start ? start : 0, count ? count : list.length).reverse(), callback);
		});
	};

	module.sortedSetCount = function(key, min, max, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			list.filter(function(a) {
				return a.score >= min && a.score <= max; // to check: greater or and equal?
			});

			callback(err, list.length);
		});
	};

	module.sortedSetCard = function(key, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			callback(err, list.length);
		});
	};

	module.sortedSetRank = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			for (var i = 0, ii=list.length; i< ii; i++) {
				if (list[i].value === value) {
					return callback(err, i);
				}
			}

			callback(err, null);
		});
	};

	module.sortedSetRevRank = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			for (var i = list.length - 1, ii=0; i > ii; i--) {
				if (list[i].value === value.toString()) {
					return callback(err, i);
				}
			}

			callback(err, null);
		});
	};

	module.sortedSetScore = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			for (var i = 0, ii=list.length; i< ii; i++) {
				if (list[i].value === value.toString()) {
					return callback(err, list[i].score);
				}
			}

			callback(err, null);
		});
	};

	module.isSortedSetMember = function(key, value, callback) {
		// maybe can be improved by having a parallel array
		module.getListRange(key, 0, -1, function(err, list) {
			for (var i = 0, ii=list.length; i< ii; i++) {
				if (list[i].value === value.toString()) {
					return callback(err, true);
				}
			}

			callback(err, false);
		});
	};

	module.sortedSetsScore = function(keys, value, callback) {
		var sets = {};
		async.each(keys, function(key, next) {
			module.sortedSetScore(key, value, function(err, score) {
				sets[key] = value;
				next();
			});
		}, function(err) {
			callback(err, sets);
		});
	};

	// lists
	module.listPrepend = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			var arr = list || [];
			arr.unshift(value);
			module.set(key, arr, callback);
		});
	};

	module.listAppend = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			var arr = list || [];
			arr.push(value);
			module.set(key, arr, function(err) {
				if (typeof callback === 'function') {
					callback(err, list);
				}
			});
		});
	};

	module.listRemoveLast = function(key, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			var arr = list || [];
			list.pop();
			module.set(key, list, callback);
		});
	};

	module.listRemoveFirst = function(key, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			var arr = list || [];
			list.shift();
			module.set(key, list, callback);
		});
	};

	module.listRemoveAll = function(key, value, callback) {
		module.set(key, [], callback);
	};

	module.getListRange = function(key, start, stop, callback) {
		// needs testing.
		module.get(key, function(err, list) {
			if (list) {
				callback(err, list.slice(start, stop === -1 ? list.length : stop));
			} else {
				callback(null, []);
			}
		});
	};

}(exports));

