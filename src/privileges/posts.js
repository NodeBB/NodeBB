
'use strict';

var async = require('async'),
	winston = require('winston'),

	posts = require('../posts'),
	topics = require('../topics'),
	user = require('../user'),
	helpers = require('./helpers'),
	groups = require('../groups'),
	categories = require('../categories');

module.exports = function(privileges) {

	privileges.posts = {};

	privileges.posts.get = function(pids, uid, callback) {
		async.parallel({
			manage_content: function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_content', uid, next);
			},
			manage_topic: function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_topic', uid, next);
			},
			isAdministrator: function(next) {
				user.isAdministrator(uid, next);
			},
		}, function(err, userResults) {
			if(err) {
				return callback(err);
			}

			var userPriv = userResults.isAdministrator || userResults.manage_topic || userResults.manage_content;

			async.parallel({
				isOwner: function(next) {
					posts.isOwner(pids, uid, next);
				},
				isModerator: function(next) {
					posts.getCidsByPids(pids, function(err, cids) {
						if (err) {
							return next(err);
						}
						user.isModerator(uid, cids, next);
					});
				}
			}, function(err, postResults) {
				if (err) {
					return callback(err);
				}

				var privileges = [];

				for (var i=0; i<pids.length; ++i) {
					var editable = userPriv || postResults.isModerator[i] || postResults.isOwner[i];
					privileges.push({
						editable: editable,
						view_deleted: editable,
						move: userResults.isAdministrator || postResults.isModerator[i]
					});
				}

				callback(null, privileges);
			});
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
		if (!pids.length) {
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
				callback(null, pids);
			});
		});
	};

	privileges.posts.canEdit = function(pid, uid, callback) {
		helpers.some([
			function(next) {
				isPostTopicLocked(pid, function(err, isLocked) {
					if (err || isLocked) {
						return next(err, false);
					}

					helpers.some([
						function(next) {
							posts.isOwner(pid, uid, next);
						},
						function(next) {
							helpers.hasEnoughReputationFor('privileges:manage_content', uid, next);
						},
						function(next) {
							helpers.hasEnoughReputationFor('privileges:manage_topic', uid, next);
						}
					], next);
				});
			},
			function(next) {
				isAdminOrMod(pid, uid, next);
			}
		], callback);
	};

	privileges.posts.canMove = function(pid, uid, callback) {
		posts.isMain(pid, function(err, isMain) {
			if (err || isMain) {
				return callback(err || new Error('[[error:cant-move-mainpost]]'));
			}
			isAdminOrMod(pid, uid, callback);
		});
	};

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
					if (err) {
						return next(err);
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
