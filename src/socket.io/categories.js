'use strict';

var	async = require('async'),
	db = require('../database'),
	categories = require('../categories'),
	privileges = require('../privileges'),
	user = require('../user'),
	topics = require('../topics'),
	websockets = require('./index'),

	SocketCategories = {};

SocketCategories.getRecentReplies = function(socket, cid, callback) {
	categories.getRecentReplies(cid, socket.uid, 4, callback);
};

SocketCategories.get = function(socket, data, callback) {
	categories.getCategoriesByPrivilege(socket.uid, 'find', callback);
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


		var set = 'cid:' + data.cid + ':tids',
			reverse = false;

		if (results.settings.categoryTopicSort === 'newest_to_oldest') {
			reverse = true;
		} else if (results.settings.categoryTopicSort === 'most_posts') {
			reverse = true;
			set = 'cid:' + data.cid + ':tids:posts';
		}

		var start = parseInt(data.after, 10),
			stop = start + results.settings.topicsPerPage - 1;

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
			targetUid: results.targetUid
		}, function(err, data) {
			if (err) {
				return callback(err);
			}

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

SocketCategories.getUsersInCategory = function(socket, cid, callback) {
	var uids = websockets.getUidsInRoom('category_' + cid);
	user.getMultipleUserFields(uids, ['uid', 'userslug', 'username', 'picture'], callback);
};

SocketCategories.getCategoriesByPrivilege = function(socket, privilege, callback) {
	categories.getCategoriesByPrivilege(socket.uid, privilege, callback);
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

module.exports = SocketCategories;
