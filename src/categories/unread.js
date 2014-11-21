
"use strict";

var async = require('async'),
	db = require('../database');

module.exports = function(Categories) {

	Categories.markAsRead = function(cids, uid, callback) {
		callback = callback || function() {};
		if (!Array.isArray(cids) || !cids.length) {
			return callback();
		}
		var keys = cids.map(function(cid) {
			return 'cid:' + cid + ':read_by_uid';
		});

		db.isMemberOfSets(keys, uid, function(err, hasRead) {
			if (err) {
				return callback(err);
			}

			keys = keys.filter(function(key, index) {
				return !hasRead[index];
			});

			if (!keys.length) {
				return callback();
			}

			db.setsAdd(keys, uid, callback);
		});
	};

	Categories.markAsUnreadForAll = function(cid, callback) {
		callback = callback || function() {};
		db.delete('cid:' + cid + ':read_by_uid', callback);
	};

	Categories.hasReadCategories = function(cids, uid, callback) {
		var sets = [];

		for (var i = 0, ii = cids.length; i < ii; i++) {
			sets.push('cid:' + cids[i] + ':read_by_uid');
		}

		db.isMemberOfSets(sets, uid, callback);
	};

	Categories.hasReadCategory = function(cid, uid, callback) {
		db.isSetMember('cid:' + cid + ':read_by_uid', uid, callback);
	};

};