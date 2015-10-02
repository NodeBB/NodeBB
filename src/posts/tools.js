'use strict';

var async = require('async'),

	privileges = require('../privileges'),
	cache = require('./cache');

module.exports = function(Posts) {
	Posts.tools = {};

	Posts.tools.delete = function(uid, pid, callback) {
		togglePostDelete(uid, pid, true, callback);
	};

	Posts.tools.restore = function(uid, pid, callback) {
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
				if (parseInt(deleted, 10) === 1 && isDelete) {
					return next(new Error('[[error:post-already-deleted]]'));
				} else if(parseInt(deleted, 10) !== 1 && !isDelete) {
					return next(new Error('[[error:post-already-restored]]'));
				}

				privileges.posts.canEdit(pid, uid, next);
			},
			function (canEdit, next) {
				if (!canEdit) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			}
		], function (err) {
			if (err) {
				return callback(err);
			}

			if (isDelete) {
				cache.del(pid);
				Posts.delete(pid, callback);
			} else {
				Posts.restore(pid, function(err, postData) {
					if (err) {
						return callback(err);
					}
					Posts.parsePost(postData, callback);
				});
			}
		});
	}

	Posts.tools.purge = function(uid, pid, callback) {
		async.waterfall([
			function (next) {
				privileges.posts.canPurge(pid, uid, next);
			},
			function (canPurge, next) {
				if (!canPurge) {
					return next(new Error('[[error:no-privileges]]'));
				}
				cache.del(pid);
				Posts.purge(pid, next);
			}
		], callback);
	};

};

