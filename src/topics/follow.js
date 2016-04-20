
'use strict';

var async = require('async');
var nconf = require('nconf');
var S = require('string');
var winston = require('winston');

var db = require('../database');
var user = require('../user');
var notifications = require('../notifications');
var privileges = require('../privileges');
var meta = require('../meta');
var emailer = require('../emailer');

module.exports = function(Topics) {

	Topics.unignore = function( tid, uid, callback ){
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function(exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				db.sortedSetRemove('uid:' + uid + ':ignored:tids', tid, next);
			},
			function(next) {
				db.setRemove('tid:' + tid + ':ignorers', uid, next);
			}
		], callback);
	};

	Topics.ignore = function(tid, uid, callback) {
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				Topics.unfollow(tid, uid, next);
			},
			function( next ){
				user.ignoreTopic( uid, tid, next );
			}
		], callback);
	};

	Topics.follow = function(tid, uid, callback) {
		callback = callback || function() {};
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
				db.setAdd('tid:' + tid + ':followers', uid, next);
			},
			function(next) {
				db.sortedSetAdd('uid:' + uid + ':followed_tids', Date.now(), tid, next);
			},
			function( next ){
				Topics.unignore( tid, uid, next );
			}
		], callback);
	};

	Topics.unfollow = function(tid, uid, callback) {
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				db.setRemove('tid:' + tid + ':followers', uid, next);
			},
			function(next) {
				db.sortedSetRemove('uid:' + uid + ':followed_tids', tid, next);
			},
			function( next ){
				Topics.unignore( tid, uid, next );
			}
		], callback);
	};

	Topics.isIgnoring = function(tids, uid, callback) {
		if (!Array.isArray(tids)) {
			return callback();
		}
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function() { return false; }));
		}
		async.waterfall([
			function(next){
				user.getIgnoredTopics( uid, next );
			},
			function(ignoredTids, next ){
				var ignored= tids.map(
					function(tid){
						return ignoredTids.indexOf(tid.toString()) != -1;
					});
				next( null, ignored );
			}
		], callback);
	};

	Topics.isFollowing = function(tids, uid, callback) {
		if (!Array.isArray(tids)) {
			return callback();
		}
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function() { return false; }));
		}
		var keys = tids.map(function(tid) {
			return 'tid:' + tid + ':followers';
		});
		db.isMemberOfSets(keys, uid, callback);
	};

	Topics.getFollowers = function(tid, callback) {
		db.getSetMembers('tid:' + tid + ':followers', callback);
	};

	Topics.notifyFollowers = function(postData, exceptUid, callback) {
		callback = callback || function() {};
		var followers;
		var title;
		var titleEscaped;

		async.waterfall([
			function (next) {
				Topics.getFollowers(postData.topic.tid, next);
			},
			function (followers, next) {
				if (!Array.isArray(followers) || !followers.length) {
					return callback();
				}
				var index = followers.indexOf(exceptUid.toString());
				if (index !== -1) {
					followers.splice(index, 1);
				}
				if (!followers.length) {
					return callback();
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
					title = S(title).decodeHTMLEntities().s;
					titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
				}

				notifications.create({
					bodyShort: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + titleEscaped + ']]',
					bodyLong: postData.content,
					pid: postData.pid,
					nid: 'new_post:tid:' + postData.topic.tid + ':pid:' + postData.pid + ':uid:' + exceptUid,
					tid: postData.topic.tid,
					from: exceptUid,
					mergeId: 'notifications:user_posted_to|' + postData.topic.tid,
					topicTitle: title
				}, next);
			},
			function (notification, next) {
				if (notification) {
					notifications.push(notification, followers);
				}

				if (parseInt(meta.config.disableEmailSubscriptions, 10) === 1) {
					return next();
				}

				async.eachLimit(followers, 3, function(toUid, next) {
					async.parallel({
						userData: async.apply(user.getUserFields, toUid, ['username', 'userslug']),
						userSettings: async.apply(user.getSettings, toUid)
					}, function(err, data) {
						if (err) {
							return next(err);
						}
						if (data.userSettings.sendPostNotifications) {
							emailer.send('notif_post', toUid, {
								pid: postData.pid,
								subject: '[' + (meta.config.title || 'NodeBB') + '] ' + title,
								intro: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + titleEscaped + ']]',
								postBody: postData.content.replace(/"\/\//g, '"http://'),
								site_title: meta.config.title || 'NodeBB',
								username: data.userData.username,
								userslug: data.userData.userslug,
								url: nconf.get('url') + '/topic/' + postData.topic.tid,
								base_url: nconf.get('url')
							}, next);
						} else {
							winston.debug('[topics.notifyFollowers] uid ' + toUid + ' does not have post notifications enabled, skipping.');
							next();
						}
					});
				});
				next();
			}
		], callback);
	};

	Topics.getIgnoringUsers = function(tid, callback){
		db.getSetMembers( 'tid:' + tid + ':ignorers', callback );
	};

	Topics.filterIgnoringUids = function(tid, uids, callback){
		async.waterfall([
			function(next){
				Topics.getIgnoringUsers(tid, next);
			},
			function(ignoringUsers, next){
				var readingUids = uids.map( function(uid){
							if( ignoringUsers.indexOf(uid) === -1 ){
								return uid;
							}
							else{
								return null;
							}
				});
				next( null, readingUids.filter( function(uid){ return uid != null;}) );
			}
		], callback );
	};
};
