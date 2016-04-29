
'use strict';

var async = require('async');

var meta = require('../meta');
var posts = require('../posts');
var topics = require('../topics');
var user = require('../user');
var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function(privileges) {

	privileges.posts = {};

	privileges.posts.get = function(pids, uid, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		async.parallel({
			isAdmin: function(next){
				user.isAdministrator(uid, next);
			},
			isModerator: function(next) {
				posts.isModerator(pids, uid, next);
			},
			isOwner: function(next) {
				posts.isOwner(pids, uid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var privileges = [];

			for (var i=0; i<pids.length; ++i) {
				var editable = results.isAdmin || results.isModerator[i] || results.isOwner[i];
				privileges.push({
					editable: editable,
					view_deleted: editable,
					move: results.isAdmin || results.isModerator[i]
				});
			}

			callback(null, privileges);
		});
	};

	privileges.posts.can = function(privilege, pid, uid, callback) {
		posts.getCidByPid(pid, function(err, cid) {
			if (err) {
				return callback(err);
			}

			privileges.categories.can(privilege, cid, uid, callback);
		});
	};

	privileges.posts.filter = function(privilege, pids, uid, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}
		var cids;
		var postData;
		var tids;
		var tidToTopic = {};

		async.waterfall([
			function (next) {
				posts.getPostsFields(pids, ['uid', 'tid', 'deleted'], next);
			},
			function (_posts, next) {
				postData = _posts;
				tids = _posts.map(function(post) {
					return post && post.tid;
				}).filter(function(tid, index, array) {
					return tid && array.indexOf(tid) === index;
				});
				topics.getTopicsFields(tids, ['deleted', 'cid'], next);
			},
			function (topicData, next) {

				topicData.forEach(function(topic, index) {
					if (topic) {
						tidToTopic[tids[index]] = topic;
					}
				});

				cids = postData.map(function(post, index) {
					if (post) {
						post.pid = pids[index];
						post.topic = tidToTopic[post.tid];
					}
					return tidToTopic[post.tid] && tidToTopic[post.tid].cid;
				}).filter(function(cid, index, array) {
					return cid && array.indexOf(cid) === index;
				});

				privileges.categories.getBase(privilege, cids, uid, next);
			},
			function (results, next) {

				var isModOf = {};
				cids = cids.filter(function(cid, index) {
					isModOf[cid] = results.isModerators[index];
					return !results.categories[index].disabled &&
						(results.allowedTo[index] || results.isAdmin || results.isModerators[index]);
				});


				pids = postData.filter(function(post) {
					return post.topic && cids.indexOf(post.topic.cid) !== -1 &&
						((parseInt(post.topic.deleted, 10) !== 1 && parseInt(post.deleted, 10) !== 1) || results.isAdmin || isModOf[post.cid]);
				}).map(function(post) {
					return post.pid;
				});

				plugins.fireHook('filter:privileges.posts.filter', {
					privilege: privilege,
					uid: uid,
					pids: pids
				}, function(err, data) {
					next(err, data ? data.pids : null);
				});
			}
		], callback);
	};

	privileges.posts.canEdit = function(pid, uid, callback) {
		async.parallel({
			isEditable: async.apply(isPostEditable, pid, uid),
			isAdminOrMod: async.apply(isAdminOrMod, pid, uid)
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			if (results.isAdminOrMod) {
				return callback(null, true);
			}
			if (results.isEditable.isLocked) {
				return callback(new Error('[[error:topic-locked]]'));
			}
			if (results.isEditable.isEditExpired) {
				return callback(new Error('[[error:post-edit-duration-expired, ' + meta.config.postEditDuration + ']]'));
			}
			callback(null, results.isEditable.editable);
		});
	};

	privileges.posts.canMove = function(pid, uid, callback) {
		posts.isMain(pid, function(err, isMain) {
			if (err || isMain) {
				return callback(err || new Error('[[error:cant-move-mainpost]]'));
			}
			isAdminOrMod(pid, uid, callback);
		});
	};

	privileges.posts.canPurge = function(pid, uid, callback) {
		async.waterfall([
			function (next) {
				posts.getCidByPid(pid, next);
			},
			function (cid, next) {
				async.parallel({
					purge: async.apply(privileges.categories.isUserAllowedTo, 'purge', cid, uid),
					owner: async.apply(posts.isOwner, pid, uid),
					isAdminOrMod: async.apply(privileges.categories.isAdminOrMod, cid, uid)
				}, next);
			},
			function (results, next) {
				next(null, results.isAdminOrMod || (results.purge && results.owner));
			}
		], callback);
	};

	function isPostEditable(pid, uid, callback) {
		async.waterfall([
			function(next) {
				posts.getPostFields(pid, ['tid', 'timestamp'], next);
			},
			function(postData, next) {
				var postEditDuration = parseInt(meta.config.postEditDuration, 10);
				if (postEditDuration && Date.now() - parseInt(postData.timestamp, 10) > postEditDuration * 1000) {
					return callback(null, {isEditExpired: true});
				}
				topics.isLocked(postData.tid, next);
			},
			function(isLocked, next) {
				if (isLocked) {
					return callback(null, {isLocked: true});
				}

				posts.isOwner(pid, uid, next);
			},
			function(isOwner, next) {
				next(null, {editable: isOwner});
			}
		], callback);
	}

	function isAdminOrMod(pid, uid, callback) {
		helpers.some([
			function(next) {
				posts.getCidByPid(pid, function(err, cid) {
					if (err || !cid) {
						return next(err, false);
					}

					user.isModerator(uid, cid, next);
				});
			},
			function(next) {
				user.isAdministrator(uid, next);
			}
		], callback);
	}
};
