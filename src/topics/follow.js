
'use strict';

var async = require('async');

var db = require('../database');
var posts = require('../posts');
var notifications = require('../notifications');
var privileges = require('../privileges');
var plugins = require('../plugins');
var utils = require('../utils');

module.exports = function (Topics) {
	Topics.toggleFollow = function (tid, uid, callback) {
		callback = callback || function () {};
		var isFollowing;
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				Topics.isFollowing([tid], uid, next);
			},
			function (_isFollowing, next) {
				isFollowing = _isFollowing[0];
				if (isFollowing) {
					Topics.unfollow(tid, uid, next);
				} else {
					Topics.follow(tid, uid, next);
				}
			},
			function (next) {
				next(null, !isFollowing);
			},
		], callback);
	};

	Topics.follow = function (tid, uid, callback) {
		setWatching(follow, unignore, 'action:topic.follow', tid, uid, callback);
	};

	Topics.unfollow = function (tid, uid, callback) {
		setWatching(unfollow, unignore, 'action:topic.unfollow', tid, uid, callback);
	};

	Topics.ignore = function (tid, uid, callback) {
		setWatching(ignore, unfollow, 'action:topic.ignore', tid, uid, callback);
	};

	function setWatching(method1, method2, hook, tid, uid, callback) {
		callback = callback || function () {};
		if (!parseInt(uid, 10)) {
			return callback();
		}
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				method1(tid, uid, next);
			},
			function (next) {
				method2(tid, uid, next);
			},
			function (next) {
				plugins.fireHook(hook, { uid: uid, tid: tid });
				next();
			},
		], callback);
	}

	function follow(tid, uid, callback) {
		addToSets('tid:' + tid + ':followers', 'uid:' + uid + ':followed_tids', tid, uid, callback);
	}

	function unfollow(tid, uid, callback) {
		removeFromSets('tid:' + tid + ':followers', 'uid:' + uid + ':followed_tids', tid, uid, callback);
	}

	function ignore(tid, uid, callback) {
		addToSets('tid:' + tid + ':ignorers', 'uid:' + uid + ':ignored_tids', tid, uid, callback);
	}

	function unignore(tid, uid, callback) {
		removeFromSets('tid:' + tid + ':ignorers', 'uid:' + uid + ':ignored_tids', tid, uid, callback);
	}

	function addToSets(set1, set2, tid, uid, callback) {
		async.waterfall([
			function (next) {
				db.setAdd(set1, uid, next);
			},
			function (next) {
				db.sortedSetAdd(set2, Date.now(), tid, next);
			},
		], callback);
	}

	function removeFromSets(set1, set2, tid, uid, callback) {
		async.waterfall([
			function (next) {
				db.setRemove(set1, uid, next);
			},
			function (next) {
				db.sortedSetRemove(set2, tid, next);
			},
		], callback);
	}

	Topics.isFollowing = function (tids, uid, callback) {
		isIgnoringOrFollowing('followers', tids, uid, callback);
	};

	Topics.isIgnoring = function (tids, uid, callback) {
		isIgnoringOrFollowing('ignorers', tids, uid, callback);
	};

	function isIgnoringOrFollowing(set, tids, uid, callback) {
		if (!Array.isArray(tids)) {
			return callback();
		}
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function () { return false; }));
		}
		var keys = tids.map(function (tid) {
			return 'tid:' + tid + ':' + set;
		});
		db.isMemberOfSets(keys, uid, callback);
	}

	Topics.getFollowers = function (tid, callback) {
		db.getSetMembers('tid:' + tid + ':followers', callback);
	};

	Topics.getIgnorers = function (tid, callback) {
		db.getSetMembers('tid:' + tid + ':ignorers', callback);
	};

	Topics.filterIgnoringUids = function (tid, uids, callback) {
		async.waterfall([
			function (next) {
				db.isSetMembers('tid:' + tid + ':ignorers', uids, next);
			},
			function (isIgnoring, next) {
				var readingUids = uids.filter(function (uid, index) {
					return uid && !isIgnoring[index];
				});
				next(null, readingUids);
			},
		], callback);
	};

	Topics.filterWatchedTids = function (tids, uid, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetScores('uid:' + uid + ':followed_tids', tids, next);
			},
			function (scores, next) {
				tids = tids.filter(function (tid, index) {
					return tid && !!scores[index];
				});
				next(null, tids);
			},
		], callback);
	};

	Topics.filterNotIgnoredTids = function (tids, uid, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetScores('uid:' + uid + ':ignored_tids', tids, next);
			},
			function (scores, next) {
				tids = tids.filter(function (tid, index) {
					return tid && !scores[index];
				});
				next(null, tids);
			},
		], callback);
	};

	Topics.notifyFollowers = function (postData, exceptUid, callback) {
		callback = callback || function () {};
		var followers;
		var title;
		var titleEscaped;

		async.waterfall([
			function (next) {
				Topics.getFollowers(postData.topic.tid, next);
			},
			function (followers, next) {
				var index = followers.indexOf(exceptUid.toString());
				if (index !== -1) {
					followers.splice(index, 1);
				}

				privileges.topics.filterUids('read', postData.topic.tid, followers, next);
			},
			function (_followers, next) {
				followers = _followers;
				if (!followers.length) {
					return callback();
				}
				title = postData.topic.title;

				if (title) {
					title = utils.decodeHTMLEntities(title);
					titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
				}

				postData.content = posts.relativeToAbsolute(postData.content, posts.urlRegex);
				postData.content = posts.relativeToAbsolute(postData.content, posts.imgRegex);

				notifications.create({
					type: 'new-reply',
					subject: title,
					bodyShort: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + titleEscaped + ']]',
					bodyLong: postData.content,
					pid: postData.pid,
					path: '/post/' + postData.pid,
					nid: 'new_post:tid:' + postData.topic.tid + ':pid:' + postData.pid + ':uid:' + exceptUid,
					tid: postData.topic.tid,
					from: exceptUid,
					mergeId: 'notifications:user_posted_to|' + postData.topic.tid,
					topicTitle: title,
				}, next);
			},
			function (notification, next) {
				if (notification) {
					notifications.push(notification, followers);
				}

				next();
			},
		], callback);
	};
};
