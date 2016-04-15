'use strict';

var	async = require('async');
var db = require('../database');
var categories = require('../categories');
var privileges = require('../privileges');
var user = require('../user');
var topics = require('../topics');
var apiController = require('../controllers/api');

var SocketCategories = {};

SocketCategories.getRecentReplies = function(socket, cid, callback) {
	categories.getRecentReplies(cid, socket.uid, 4, callback);
};

SocketCategories.get = function(socket, data, callback) {
	async.parallel({
		isAdmin: async.apply(user.isAdministrator, socket.uid),
		categories: function(next) {
			async.waterfall([
				async.apply(db.getSortedSetRange, 'categories:cid', 0, -1),
				async.apply(categories.getCategoriesData),
			], next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		results.categories = results.categories.filter(function(category) {
			return category && (!category.disabled || results.isAdmin);
		});

		callback(null, results.categories);
	});
};

SocketCategories.getWatchedCategories = function(socket, data, callback) {
	async.parallel({
		categories: async.apply(categories.getCategoriesByPrivilege, socket.uid, 'find'),
		ignoredCids: async.apply(user.getIgnoredCategories, socket.uid)
	}, function(err, results) {
		if (err) {
			return callback(err);
		}
		var watchedCategories =  results.categories.filter(function(category) {
			return category && results.ignoredCids.indexOf(category.cid.toString()) === -1;
		});
		callback(null, watchedCategories);
	});
};

SocketCategories.loadMore = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		privileges: function(next) {
			privileges.categories.get(data.cid, socket.uid, next);
		},
		settings: function(next) {
			user.getSettings(socket.uid, next);
		},
		targetUid: function(next) {
			if (data.author) {
				user.getUidByUserslug(data.author, next);
			} else {
				next();
			}
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		if (!results.privileges.read) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		var infScrollTopicsPerPage = 20;
		var set = 'cid:' + data.cid + ':tids',
			reverse = false;

		if (results.settings.categoryTopicSort === 'newest_to_oldest') {
			reverse = true;
		} else if (results.settings.categoryTopicSort === 'most_posts') {
			reverse = true;
			set = 'cid:' + data.cid + ':tids:posts';
		}

		var start = Math.max(0, parseInt(data.after, 10)) + 1;

		if (data.direction === -1) {
			start = start - (reverse ? infScrollTopicsPerPage : -infScrollTopicsPerPage);
		}

		var stop = start + infScrollTopicsPerPage - 1;

		start = Math.max(0, start);
		stop = Math.max(0, stop);

		if (results.targetUid) {
			set = 'cid:' + data.cid + ':uid:' + results.targetUid + ':tids';
		}

		categories.getCategoryTopics({
			cid: data.cid,
			set: set,
			reverse: reverse,
			start: start,
			stop: stop,
			uid: socket.uid,
			targetUid: results.targetUid,
			settings: results.settings
		}, function(err, data) {
			if (err) {
				return callback(err);
			}

			categories.modifyTopicsByPrivilege(data.topics, results.privileges);

			data.privileges = results.privileges;
			data.template = {
				category: true,
				name: 'category'
			};

			callback(null, data);
		});
	});
};

SocketCategories.getPageCount = function(socket, cid, callback) {
	categories.getPageCount(cid, socket.uid, callback);
};

SocketCategories.getTopicCount = function(socket, cid, callback) {
	categories.getCategoryField(cid, 'topic_count', callback);
};

SocketCategories.getCategoriesByPrivilege = function(socket, privilege, callback) {
	categories.getCategoriesByPrivilege('categories:cid', socket.uid, privilege, callback);
};

SocketCategories.getMoveCategories = function(socket, data, callback) {
	async.parallel({
		isAdmin: async.apply(user.isAdministrator, socket.uid),
		categories: function(next) {
			async.waterfall([
				function (next) {
					db.getSortedSetRange('cid:0:children', 0, -1, next);
				},
				function (cids, next) {
					categories.getCategories(cids, socket.uid, next);
				}
			], next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		results.categories = results.categories.filter(function(category) {
			return category && (!category.disabled || results.isAdmin) && !category.link;
		});

		callback(null, results.categories);
	});
};

SocketCategories.watch = function(socket, cid, callback) {
	user.watchCategory(socket.uid, cid, function(err) {
		if (err) {
			return callback(err);
		}
		topics.pushUnreadCount(socket.uid, callback);
	});
};

SocketCategories.ignore = function(socket, cid, callback) {
	user.ignoreCategory(socket.uid, cid, function(err) {
		if (err) {
			return callback(err);
		}
		topics.pushUnreadCount(socket.uid, callback);
	});
};

SocketCategories.isModerator = function(socket, cid, callback) {
	user.isModerator(socket.uid, cid, callback);
};

SocketCategories.getCategory = function(socket, cid, callback) {
	apiController.getObjectByType(socket.uid, 'category', cid, callback);
};

module.exports = SocketCategories;
