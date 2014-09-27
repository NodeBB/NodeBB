"use strict";

var async = require('async');


module.exports = function(db, module) {
	var helpers = module.helpers.level;

	module.sortedSetAdd = function(key, score, value, callback) {
		if (Array.isArray(score) && Array.isArray(value)) {
			return sortedSetAddMulti(key, score, value, callback);
		}
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

	function sortedSetAddMulti(key, scores, values, callback) {
		throw new Error('not implemented');
	}

	module.sortedSetsAdd = function(keys, score, value, callback) {
		async.each(keys, function(key, next) {
			module.sortedSetAdd(key, score, value, next);
		}, function(err) {
			callback(err);
		});
	};

	module.sortedSetRemove = function(key, value, callback) {
		if (!Array.isArray(value)) {
			value = [value];
		}
		module.getListRange(key, 0, -1, function(err, set) {
			set = set.filter(function(a) { return value.indexOf(a) === -1;});
			module.set(key, set, callback);
		});
	};

	module.sortedSetsRemove = function(keys, value, callback) {
		async.each(keys, function(key, next) {
			module.sortedSetRemove(key, value, next);
		}, callback);
	};

	module.sortedSetsRemoveRangeByScore = function(keys, min, max, callback) {
		throw new Error('not implemented');
	};

	function flattenSortedSet(set, callback) {
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

	module.getSortedSetRevRangeWithScores = function(key, start, stop, callback) {
		module.getListRange(key, start, stop, function(err, set) {
			if (err) {
				return callback(err);
			}
			set.sort(function(a, b) {return b.score - a.score;});
			callback(null, set);
		});
	};

	module.getSortedSetRangeByScore = function(key, start, count, min, max, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			if (min && max) {
				list.filter(function(a) {
					return a.score >= min && a.score <= max; // to check: greater or and equal?
				});
			}

			flattenSortedSet(list.slice(start ? start : 0, count ? count : list.length), callback);
		});
	};

	module.getSortedSetRevRangeByScore = function(key, start, count, max, min, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			if (min && max) {
				list.filter(function(a) {
					return a.score >= min && a.score <= max; // to check: greater or and equal?
				});
			}

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

	module.sortedSetsCard = function(keys, callback) {
		async.map(keys, module.sortedSetCard, callback);
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

	module.sortedSetsRanks = function(keys, values, callback) {
		throw new Error('not implemented');
	};

	module.sortedSetRanks = function(key, values, callback) {
		throw new Error('not implemented');
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

	module.sortedSetScores = function(key, values, callback) {
		values = values.map(function(value) {
			return value ? value.toString() : value;
		});

		module.getListRange(key, 0, -1, function(err, list) {
			if (err) {
				return callback(err);
			}

			var map = {};
			list = list.filter(function(item) {
				return values.indexOf(item.value) !== -1;
			}).forEach(function(item) {
				map[item.value] = item.score;
			});

			var	returnData = new Array(values.length),
				score;

			for(var i=0; i<values.length; ++i) {
				score = map[values[i]];
				returnData[i] = score ? score : null;
			}

			callback(null, returnData);
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

	module.isSortedSetMembers = function(key, values, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			list = list.map(function(item) {
				return item.value;
			});
			values = values.map(function(value) {
				return list.indexOf(value.toString()) !== -1;
			});

			callback(err, values);
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

	module.getSortedSetUnion = function(sets, start, stop, callback) {
		sortedSetUnion(sets, false, start, stop, callback);
	};

	module.getSortedSetRevUnion = function(sets, start, stop, callback) {
		sortedSetUnion(sets, true, start, stop, callback);
	};

	function sortedSetUnion(sets, reverse, start, stop, callback) {
		async.map(sets, function(key, next) {
			module.getListRange(key, 0, -1, next);
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var data = {};

			results.forEach(function(set) {
				for(var i=0; i<set.length; ++i) {
					data[set[i].value] = data[set[i].value] || {value: set[i].value, score: 0};
					data[set[i].value].score += parseInt(set[i].score, 10);
				}
			});

			var returnData = [];

			for(var key in data) {
				if (data.hasOwnProperty(key)) {
					returnData.push(data[key]);
				}
			}

			returnData = returnData.sort(function(a, b) {
				return reverse ? b.score - a.score : a.score - b.score;
			}).map(function(item) {
				return item.value;
			});

			callback(null, returnData);
		});
	}

	module.sortedSetIncrBy = function(key, increment, value, callback) {
		throw new Error('not implemented');
	};
};