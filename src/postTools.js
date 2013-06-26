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
			posts.get_tid_by_pid(pid, function(tid) {
					threadTools.privileges(tid, uid, function(privileges) {
						next(null, privileges);
					});
				});
		}

		function isOwnPost(next) {
			RDB.get('pid:' + pid + ':uid', function(err, author) {
					if (author && parseInt(author) > 0) {
						next(null, author === uid);
					}
				});
		}

		function hasEnoughRep(next) {
			// DRY fail in threadTools.

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
				RDB.set('pid:' + pid + ':content', content);
				RDB.set('pid:' + pid + ':edited', Date.now());
				RDB.set('pid:' + pid + ':editor', uid);

				posts.get_tid_by_pid(pid, function(tid) {
					PostTools.isMain(pid, tid, function(isMainPost) {
						if (isMainPost) RDB.set('tid:' + tid + ':title', title);

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
				RDB.set('pid:' + pid + ':deleted', 1);

				posts.get_tid_by_pid(pid, function(tid) {
					io.sockets.in('topic_' + tid).emit('event:post_deleted', {
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

	PostTools.restore = function(uid, pid) {
		var	success = function() {
				RDB.del('pid:' + pid + ':deleted');

				posts.get_tid_by_pid(pid, function(tid) {
					io.sockets.in('topic_' + tid).emit('event:post_restored', {
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

	PostTools.constructPostObject = function(rawPosts, tid, current_user, privileges, callback) {
		var postObj = [];

		async.waterfall([
			function(next) {
				if (!privileges) {
					threadTools.privileges(tid, current_user, function(privs) {
						privileges = privs;
						next();
					});
				} else {
					next();
				}
			},
			function(next) {
				var postData = rawPosts.postData,
					userData = rawPosts.userData,
					voteData = rawPosts.voteData;

				if (!postData) {
					return next(null, []);
				}

				for (var i=0, ii= postData.pid.length; i<ii; i++) {
					var uid = postData.uid[i],
						pid = postData.pid[i];
					
					// ############ to be moved into posts.getPostsByTid ############
					if (postData.deleted[i] === null || (postData.deleted[i] === '1' && privileges.view_deleted) || current_user === uid) {
						var post_obj = {
							'pid' : pid,
							'uid' : uid,
							'content' : marked(postData.content[i] || ''),
							'post_rep' : postData.reputation[i] || 0,
							'timestamp' : postData.timestamp[i],
							'relativeTime': utils.relativeTime(postData.timestamp[i]),
							'username' : userData[uid].username || 'anonymous',
							'userslug' : userData[uid].userslug || '',
							'user_rep' : userData[uid].reputation || 0,
							'gravatar' : userData[uid].picture || 'http://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e',
							'signature' : marked(userData[uid].signature || ''),
							'fav_star_class' : voteData[pid] ? 'icon-star' : 'icon-star-empty',
							'display_moderator_tools': (uid == current_user || privileges.editable) ? 'show' : 'none',
							'edited-class': postData.editor[i] !== null ? '' : 'none',
							'editor': postData.editor[i] !== null ? userData[postData.editor[i]].username : '',
							'relativeEditTime': postData.editTime !== null ? utils.relativeTime(postData.editTime[i]) : '',
							'deleted': postData.deleted[i] || '0'
						};

						postObj.push(post_obj);
					}
					// ########## end to be moved into posts.getPostsByTid ############
				}

				next(null);
			}
		], function(err) {
			callback(postObj);
		});
	}

}(exports));