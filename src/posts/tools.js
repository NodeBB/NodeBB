'use strict';

var async = require('async');

var privileges = require('../privileges');

module.exports = function (Posts) {
	Posts.tools = {};

	Posts.tools.delete = function (uid, pid, callback) {
		togglePostDelete(uid, pid, true, callback);
	};

	Posts.tools.restore = function (uid, pid, callback) {
		togglePostDelete(uid, pid, false, callback);
	};

	function togglePostDelete(uid, pid, isDelete, callback) {
		async.waterfall([
			function (next) {
				Posts.exists(pid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-post]]'));
				}
				Posts.getPostField(pid, 'deleted', next);
			},
			function (deleted, next) {
				if (deleted && isDelete) {
					return next(new Error('[[error:post-already-deleted]]'));
				} else if (!deleted && !isDelete) {
					return next(new Error('[[error:post-already-restored]]'));
				}

				privileges.posts.canDelete(pid, uid, next);
			},
			function (canDelete, next) {
				if (!canDelete.flag) {
					return next(new Error(canDelete.message));
				}

				if (isDelete) {
					require('./cache').del(pid);
					Posts.delete(pid, uid, next);
				} else {
					Posts.restore(pid, uid, function (err, postData) {
						if (err) {
							return next(err);
						}
						Posts.parsePost(postData, next);
					});
				}
			},
		], callback);
	}

	Posts.tools.purge = function (uid, pid, callback) {
		async.waterfall([
			function (next) {
				privileges.posts.canPurge(pid, uid, next);
			},
			function (canPurge, next) {
				if (!canPurge) {
					return next(new Error('[[error:no-privileges]]'));
				}
				require('./cache').del(pid);
				Posts.purge(pid, uid, next);
			},
		], callback);
	};
};
