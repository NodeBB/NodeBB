
'use strict';

var async = require('async'),
	winston = require('winston'),

	meta = require('../meta'),
	posts = require('../posts'),
	topics = require('../topics'),
	user = require('../user'),
	helpers = require('./helpers'),
	groups = require('../groups'),
	categories = require('../categories'),
	plugins = require('../plugins');

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
		posts.getCidsByPids(pids, function(err, cids) {
			if (err) {
				return callback(err);
			}

			pids = pids.map(function(pid, index) {
				return {pid: pid, cid: cids[index]};
			});

			privileges.categories.filterCids(privilege, cids, uid, function(err, cids) {
				if (err) {
					return callback(err);
				}

				pids = pids.filter(function(post) {
					return cids.indexOf(post.cid) !== -1;
				}).map(function(post) {
					return post.pid;
				});

				plugins.fireHook('filter:privileges.posts.filter', {
					privilege: privilege,
					uid: uid,
					pids: pids
				},  function(err, data) {
					callback(err, data ? data.pids : null);
				});
			});
		});
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
				return callback(new Error('[[error:topic-locked]]]'));
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

	function isPostTopicLocked(pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			if (err) {
				return callback(err);
			}
			topics.isLocked(tid, callback);
		});
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
