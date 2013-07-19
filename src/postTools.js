var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	topics = require('./topics'),
	threadTools = require('./threadTools.js'),
	user = require('./user.js'),
	async = require('async'),
	marked = require('marked'),
	utils = require('../public/src/utils');

marked.setOptions({
	breaks: true
});

(function(PostTools) {
	PostTools.isMain = function(pid, tid, callback) {
		RDB.lrange('tid:' + tid + ':posts', 0, 0, function(err, pids) {
			if (pids[0] === pid) callback(true);
			else callback(false);
		})
	}

	PostTools.privileges = function(pid, uid, callback) {
		//todo: break early if one condition is true 
		
		function getThreadPrivileges(next) {
			posts.getPostField(pid, 'tid', function(tid) {
				threadTools.privileges(tid, uid, function(privileges) {
					next(null, privileges);
				});
			});
		}

		function isOwnPost(next) {
			posts.getPostField(pid, 'uid', function(author) {
				if (author && parseInt(author) > 0) {
					next(null, author === uid);
				}
			});
		}

		function hasEnoughRep(next) {
			user.getUserField(uid, 'reputation', function(reputation) {
				next(null, reputation >= global.config['privileges:manage_content']);
			});
		}

		async.parallel([getThreadPrivileges, isOwnPost, hasEnoughRep], function(err, results) {
			callback({
				editable: results[0].editable || (results.slice(1).indexOf(true) !== -1 ? true : false),
				view_deleted: results[0].view_deleted || (results.slice(1).indexOf(true) !== -1 ? true : false)
			});
		});
	}

	PostTools.edit = function(uid, pid, title, content) {

		var	success = function() {
			posts.setPostField(pid, 'content', content);
			posts.setPostField(pid, 'edited', Date.now());
			posts.setPostField(pid, 'editor', uid);

			posts.getPostField(pid, 'tid', function(tid) {
				PostTools.isMain(pid, tid, function(isMainPost) {
					if (isMainPost) 
						topics.setTopicField(tid, 'title', title);

					io.sockets.in('topic_' + tid).emit('event:post_edited', {
						pid: pid,
						title: title,
						content: marked(content || '')
					});
				});
			});
		};

		PostTools.privileges(pid, uid, function(privileges) {
			if (privileges.editable) {
				success();
			}
		});
	}

	PostTools.delete = function(uid, pid) {
		var	success = function() {
			posts.setPostField(pid, 'deleted', 1);
			

			posts.getPostFields(pid, ['tid', 'uid'], function(postData) {

				user.decrementUserFieldBypostData.uid, 'postcount', 1);
				
				io.sockets.in('topic_' + postData.tid).emit('event:post_deleted', {
					pid: pid
				});

				// Delete the thread if it is the last undeleted post
				threadTools.get_latest_undeleted_pid(postData.tid, function(err, pid) {
					if (err && err.message === 'no-undeleted-pids-found') {
						threadTools.delete(postData.tid, -1, function(err) {
							if (err) console.log('Error: Could not delete topic (tid: ' + postData.tid + ')');
						});
					} else {
						posts.getPostField(pid, 'timestamp', function(timestamp) {
							topics.updateTimestamp(postData.tid, timestamp);	
						});	
					}
				});
			});
		};

		PostTools.privileges(pid, uid, function(privileges) {
			if (privileges.editable) {
				success();
			}
		});
	}

	PostTools.restore = function(uid, pid) {
		var	success = function() {
			posts.setPostField(pid, 'deleted', 0);

			posts.getPostFields(pid, ['tid', 'uid', function(postData) {

				user.incrementUserFieldBy(postData.uid, 'postcount', 1);

				io.sockets.in('topic_' + postData.tid).emit('event:post_restored', {
					pid: pid
				});
			});
		};

		PostTools.privileges(pid, uid, function(privileges) {
			if (privileges.editable) {
				success();
			}
		});
	}


}(exports));