'use strict';

var async = require('async');

var categories = require('../categories');
var privileges = require('../privileges');
var user = require('../user');
var topics = require('../topics');
var apiController = require('../controllers/api');

var SocketCategories = module.exports;

SocketCategories.getRecentReplies = function (socket, cid, callback) {
	categories.getRecentReplies(cid, socket.uid, 4, callback);
};

SocketCategories.get = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				isAdmin: async.apply(user.isAdministrator, socket.uid),
				categories: function (next) {
					async.waterfall([
						async.apply(categories.getCidsByPrivilege, 'categories:cid', socket.uid, 'find'),
						async.apply(categories.getCategoriesData),
					], next);
				},
			}, next);
		},
		function (results, next) {
			results.categories = results.categories.filter(function (category) {
				return category && (!category.disabled || results.isAdmin);
			});

			next(null, results.categories);
		},
	], callback);
};

SocketCategories.getWatchedCategories = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				categories: async.apply(categories.getCategoriesByPrivilege, 'cid:0:children', socket.uid, 'find'),
				ignoredCids: async.apply(user.getIgnoredCategories, socket.uid),
			}, next);
		},
		function (results, next) {
			var watchedCategories = results.categories.filter(function (category) {
				return category && !results.ignoredCids.includes(String(category.cid));
			});

			next(null, watchedCategories);
		},
	], callback);
};

SocketCategories.loadMore = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	data.query = data.query || {};
	var userPrivileges;
	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function (next) {
					privileges.categories.get(data.cid, socket.uid, next);
				},
				settings: function (next) {
					user.getSettings(socket.uid, next);
				},
				targetUid: function (next) {
					if (data.query.author) {
						user.getUidByUserslug(data.query.author, next);
					} else {
						next();
					}
				},
			}, next);
		},
		function (results, next) {
			userPrivileges = results.privileges;
			if (!userPrivileges.read) {
				return callback(new Error('[[error:no-privileges]]'));
			}
			var infScrollTopicsPerPage = 20;
			var sort = data.sort || data.categoryTopicSort;

			var start = Math.max(0, parseInt(data.after, 10));

			if (data.direction === -1) {
				start -= infScrollTopicsPerPage;
			}

			var stop = start + infScrollTopicsPerPage - 1;

			start = Math.max(0, start);
			stop = Math.max(0, stop);
			categories.getCategoryTopics({
				uid: socket.uid,
				cid: data.cid,
				start: start,
				stop: stop,
				sort: sort,
				settings: results.settings,
				query: data.query,
				tag: data.query.tag,
				targetUid: results.targetUid,
			}, next);
		},
		function (data, next) {
			categories.modifyTopicsByPrivilege(data.topics, userPrivileges);

			data.privileges = userPrivileges;
			data.template = {
				category: true,
				name: 'category',
			};

			next(null, data);
		},
	], callback);
};

SocketCategories.getTopicCount = function (socket, cid, callback) {
	categories.getCategoryField(cid, 'topic_count', callback);
};

SocketCategories.getCategoriesByPrivilege = function (socket, privilege, callback) {
	categories.getCategoriesByPrivilege('categories:cid', socket.uid, privilege, callback);
};

SocketCategories.getMoveCategories = function (socket, data, callback) {
	SocketCategories.getSelectCategories(socket, data, callback);
};

SocketCategories.getSelectCategories = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				isAdmin: async.apply(user.isAdministrator, socket.uid),
				categories: function (next) {
					categories.buildForSelect(socket.uid, 'find', next);
				},
			}, next);
		},
		function (results, next) {
			results.categories = results.categories.filter(function (category) {
				return category && (!category.disabled || results.isAdmin) && !category.link;
			});

			next(null, results.categories);
		},
	], callback);
};

SocketCategories.setWatchState = function (socket, data, callback) {
	if (!data || !data.cid || !data.state) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	ignoreOrWatch(function (uid, cid, next) {
		user.setCategoryWatchState(uid, cid, categories.watchStates[data.state], next);
	}, socket, data, callback);
};

SocketCategories.watch = function (socket, data, callback) {
	ignoreOrWatch(user.watchCategory, socket, data, callback);
};

SocketCategories.ignore = function (socket, data, callback) {
	ignoreOrWatch(user.ignoreCategory, socket, data, callback);
};

function ignoreOrWatch(fn, socket, data, callback) {
	var targetUid = socket.uid;
	var cids = [parseInt(data.cid, 10)];
	if (data.hasOwnProperty('uid')) {
		targetUid = data.uid;
	}

	async.waterfall([
		function (next) {
			user.isAdminOrGlobalModOrSelf(socket.uid, targetUid, next);
		},
		function (next) {
			categories.getAllCidsFromSet('categories:cid', next);
		},
		function (cids, next) {
			categories.getCategoriesFields(cids, ['cid', 'parentCid'], next);
		},
		function (categoryData, next) {
			// filter to subcategories of cid
			var cat;
			do {
				cat = categoryData.find(function (c) {
					return !cids.includes(c.cid) && cids.includes(c.parentCid);
				});
				if (cat) {
					cids.push(cat.cid);
				}
			} while (cat);

			async.each(cids, function (cid, next) {
				fn(targetUid, cid, next);
			}, next);
		},
		function (next) {
			topics.pushUnreadCount(targetUid, next);
		},
		function (next) {
			next(null, cids);
		},
	], callback);
}

SocketCategories.isModerator = function (socket, cid, callback) {
	user.isModerator(socket.uid, cid, callback);
};

SocketCategories.getCategory = function (socket, cid, callback) {
	apiController.getCategoryData(cid, socket.uid, callback);
};
