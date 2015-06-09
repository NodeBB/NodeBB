'use strict';

var async = require('async'),

	posts = require('./posts'),
	privileges = require('./privileges'),
	cache = require('./posts/cache');

(function(PostTools) {

	PostTools.edit = function(data, callback) {
		posts.edit(data, callback);
	};

	PostTools.delete = function(uid, pid, callback) {
		togglePostDelete(uid, pid, true, callback);
	};

	PostTools.restore = function(uid, pid, callback) {
		togglePostDelete(uid, pid, false, callback);
	};

	function togglePostDelete(uid, pid, isDelete, callback) {
		async.waterfall([
			function(next) {
				posts.getPostField(pid, 'deleted', next);
			},
			function(deleted, next) {
				if(parseInt(deleted, 10) === 1 && isDelete) {
					return next(new Error('[[error:post-already-deleted]]'));
				} else if(parseInt(deleted, 10) !== 1 && !isDelete) {
					return next(new Error('[[error:post-already-restored]]'));
				}

				privileges.posts.canEdit(pid, uid, next);
			},
			function(canEdit, next) {
				if (!canEdit) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			if (isDelete) {
				cache.del(pid);
				posts.delete(pid, callback);
			} else {
				posts.restore(pid, function(err, postData) {
					if (err) {
						return callback(err);
					}
					posts.parsePost(postData, callback);
				});
			}
		});
	}

	PostTools.purge = function(uid, pid, callback) {
		privileges.posts.canEdit(pid, uid, function(err, canEdit) {
			if (err || !canEdit) {
				return callback(err || new Error('[[error:no-privileges]]'));
			}
			cache.del(pid);
			posts.purge(pid, callback);
		});
	};


}(exports));
