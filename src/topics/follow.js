
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

	Topics.follow = async function (tid, uid) {
		await setWatching(follow, unignore, 'action:topic.follow', tid, uid);
	};

	Topics.unfollow = async function (tid, uid) {
		await setWatching(unfollow, unignore, 'action:topic.unfollow', tid, uid);
	};

	Topics.ignore = async function (tid, uid) {
		await setWatching(ignore, unfollow, 'action:topic.ignore', tid, uid);
	};

	async function setWatching(method1, method2, hook, tid, uid) {
		if (parseInt(uid, 10) <= 0) {
			return;
		}
		const exists = await Topics.exists(tid);
		if (!exists) {
			throw new Error('[[error:no-topic]]');
		}
		await method1(tid, uid);
		await method2(tid, uid);
		plugins.fireHook(hook, { uid: uid, tid: tid });
	}

	async function follow(tid, uid) {
		await addToSets('tid:' + tid + ':followers', 'uid:' + uid + ':followed_tids', tid, uid);
	}

	async function unfollow(tid, uid) {
		await removeFromSets('tid:' + tid + ':followers', 'uid:' + uid + ':followed_tids', tid, uid);
	}

	async function ignore(tid, uid) {
		await addToSets('tid:' + tid + ':ignorers', 'uid:' + uid + ':ignored_tids', tid, uid);
	}

	async function unignore(tid, uid) {
		await removeFromSets('tid:' + tid + ':ignorers', 'uid:' + uid + ':ignored_tids', tid, uid);
	}

	async function addToSets(set1, set2, tid, uid) {
		await db.setAdd(set1, uid);
		await db.sortedSetAdd(set2, Date.now(), tid);
	}

	async function removeFromSets(set1, set2, tid, uid) {
		await db.setRemove(set1, uid);
		await db.sortedSetRemove(set2, tid);
	}

	Topics.isFollowing = function (tids, uid, callback) {
		isIgnoringOrFollowing('followers', tids, uid, callback);
	};

	Topics.isIgnoring = function (tids, uid, callback) {
		isIgnoringOrFollowing('ignorers', tids, uid, callback);
	};

	Topics.getFollowData = function (tids, uid, callback) {
		if (!Array.isArray(tids)) {
			return setImmediate(callback);
		}
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, tids.map(() => ({ following: false, ignoring: false })));
		}
		const keys = [];
		tids.forEach((tid) => {
			keys.push('tid:' + tid + ':followers', 'tid:' + tid + ':ignorers');
		});

		db.isMemberOfSets(keys, uid, function (err, data) {
			if (err) {
				return callback(err);
			}
			const followData = [];
			for (let i = 0; i < data.length; i += 2) {
				followData.push({
					following: data[i],
					ignoring: data[i + 1],
				});
			}
			callback(null, followData);
		});
	};

	function isIgnoringOrFollowing(set, tids, uid, callback) {
		if (!Array.isArray(tids)) {
			return setImmediate(callback);
		}
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, tids.map(() => false));
		}
		var keys = tids.map(tid => 'tid:' + tid + ':' + set);
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
				const readingUids = uids.filter((uid, index) => uid && !isIgnoring[index]);
				next(null, readingUids);
			},
		], callback);
	};

	Topics.filterWatchedTids = function (tids, uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, []);
		}
		async.waterfall([
			function (next) {
				db.sortedSetScores('uid:' + uid + ':followed_tids', tids, next);
			},
			function (scores, next) {
				tids = tids.filter((tid, index) => tid && !!scores[index]);
				next(null, tids);
			},
		], callback);
	};

	Topics.filterNotIgnoredTids = function (tids, uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, tids);
		}
		async.waterfall([
			function (next) {
				db.sortedSetScores('uid:' + uid + ':ignored_tids', tids, next);
			},
			function (scores, next) {
				tids = tids.filter((tid, index) => tid && !scores[index]);
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

				privileges.topics.filterUids('topics:read', postData.topic.tid, followers, next);
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
