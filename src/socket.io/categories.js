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
	privileges.categories.can('read', cid, socket.uid, function(err, canRead) {
		if (err) {
			return callback(err);
		}

		if (!canRead) {
			return callback(null, []);
		}

		categories.getRecentReplies(cid, socket.uid, 4, callback);
	});
};

SocketCategories.get = function(socket, data, callback) {
	categories.getCategoriesByPrivilege(socket.uid, 'find', callback);
};

SocketCategories.loadMore = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		privileges: function(next) {
			privileges.categories.get(data.cid, socket.uid, next);
		},
		settings: function(next) {
			user.getSettings(socket.uid, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		if (!results.privileges.read) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		var start = parseInt(data.after, 10),
			end = start + results.settings.topicsPerPage - 1;

		categories.getCategoryTopics(data.cid, start, end, socket.uid, function(err, data) {
			if (err) {
				return callback(err);
			}

			data.privileges = results.privileges;
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

SocketCategories.lastTopicIndex = function(socket, cid, callback) {
	db.sortedSetCard('categories:' + cid + ':tid', callback);
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

module.exports = SocketCategories;
