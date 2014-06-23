"use strict";

var async = require('async'),
	gravatar = require('gravatar'),
	validator = require('validator'),

	db = require('./database'),
	posts = require('./posts'),
	utils = require('./../public/src/utils'),
	plugins = require('./plugins'),
	user = require('./user'),
	categories = require('./categories'),
	privileges = require('./privileges');

(function(Topics) {

	require('./topics/create')(Topics);
	require('./topics/delete')(Topics);
	require('./topics/unread')(Topics);
	require('./topics/recent')(Topics);
	require('./topics/fork')(Topics);
	require('./topics/posts')(Topics);
	require('./topics/follow')(Topics);
	require('./topics/tags')(Topics);

	Topics.getTopicData = function(tid, callback) {
		Topics.getTopicsData([tid], function(err, topics) {
			if (err) {
				return callback(err);
			}

			callback(null, topics ? topics[0] : null);
		});
	};

	Topics.getTopicsData = function(tids, callback) {
		var keys = [];

		for (var i=0; i<tids.length; ++i) {
			keys.push('topic:' + tids[i]);
		}

		db.getObjects(keys, function(err, topics) {
			if (err) {
				return callback(err);
			}

			for (var i=0; i<tids.length; ++i) {
				if(topics[i]) {
					topics[i].title = validator.escape(topics[i].title);
					topics[i].relativeTime = utils.toISOString(topics[i].timestamp);
				}
			}

			callback(null, topics);
		});
	};

	Topics.getTopicDataWithUser = function(tid, callback) {
		Topics.getTopicData(tid, function(err, topic) {
			if (err || !topic) {
				return callback(err || new Error('[[error:no-topic]]'));
			}

			user.getUserFields(topic.uid, ['username', 'userslug', 'picture'], function(err, userData) {
				if (err) {
					return callback(err);
				}

				topic.user = userData;
				callback(null, topic);
			});
		});
	};

	Topics.getPageCount = function(tid, uid, callback) {
		db.sortedSetCard('tid:' + tid + ':posts', function(err, postCount) {
			if(err) {
				return callback(err);
			}
			if(!parseInt(postCount, 10)) {
				return callback(null, 1);
			}
			user.getSettings(uid, function(err, settings) {
				if(err) {
					return callback(err);
				}

				callback(null, Math.ceil(parseInt(postCount, 10) / settings.postsPerPage));
			});
		});
	};

	Topics.getTidPage = function(tid, uid, callback) {
		if(!tid) {
			return callback(new Error('[[error:invalid-tid]]'));
		}

		async.parallel({
			index: function(next) {
				categories.getTopicIndex(tid, next);
			},
			settings: function(next) {
				user.getSettings(uid, next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}
			callback(null, Math.ceil((results.index + 1) / results.settings.topicsPerPage));
		});
	};

	Topics.getCategoryData = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				callback(err);
			}

			categories.getCategoryData(cid, callback);
		});
	};

	Topics.getTopics = function(set, uid, tids, callback) {
		var returnTopics = {
			topics: [],
			nextStart: 0
		};

		if (!tids || !tids.length) {
			return callback(null, returnTopics);
		}

		async.filter(tids, function(tid, next) {
			privileges.topics.can('read', tid, uid, function(err, canRead) {
				next(!err && canRead);
			});
		}, function(tids) {
			Topics.getTopicsByTids(tids, uid, function(err, topicData) {
				if(err) {
					return callback(err);
				}

				if(!topicData || !topicData.length) {
					return callback(null, returnTopics);
				}

				db.sortedSetRevRank(set, topicData[topicData.length - 1].tid, function(err, rank) {
					if(err) {
						return callback(err);
					}

					returnTopics.nextStart = parseInt(rank, 10) + 1;
					returnTopics.topics = topicData;
					callback(null, returnTopics);
				});
			});
		});
	};

	Topics.getTopicsFromSet = function(uid, set, start, end, callback) {
		db.getSortedSetRevRange(set, start, end, function(err, tids) {
			if(err) {
				return callback(err);
			}

			Topics.getTopics(set, uid, tids, callback);
		});
	};

	Topics.getTopicsByTids = function(tids, uid, callback) {
		if (!Array.isArray(tids) || tids.length === 0) {
			return callback(null, []);
		}

		var categoryCache = {},
			privilegeCache = {},
			userCache = {};


		function loadTopicInfo(topicData, next) {
			if (!topicData) {
				return next(null, null);
			}

			function isTopicVisible(topicData, topicInfo) {
				var deleted = parseInt(topicData.deleted, 10) !== 0;
				return !deleted || (deleted && topicInfo.privileges.view_deleted) || parseInt(topicData.uid, 10) === parseInt(uid, 10);
			}

			async.parallel({
				hasread: function(next) {
					Topics.hasReadTopic(topicData.tid, uid, next);
				},
				teaser: function(next) {
					Topics.getTeaser(topicData.tid, next);
				},
				privileges: function(next) {
					if (privilegeCache[topicData.cid]) {
						return next(null, privilegeCache[topicData.cid]);
					}
					privileges.categories.get(topicData.cid, uid, next);
				},
				categoryData: function(next) {
					if (categoryCache[topicData.cid]) {
						return next(null, categoryCache[topicData.cid]);
					}
					categories.getCategoryFields(topicData.cid, ['name', 'slug', 'icon', 'bgColor', 'color'], next);
				},
				user: function(next) {
					if (userCache[topicData.uid]) {
						return next(null, userCache[topicData.uid]);
					}
					user.getUserFields(topicData.uid, ['username', 'userslug', 'picture'], next);
				},
				tags: function(next) {
					Topics.getTopicTagsObjects(topicData.tid, next);
				}
			}, function(err, topicInfo) {
				if(err) {
					return next(err);
				}

				privilegeCache[topicData.cid] = topicInfo.privileges;
				categoryCache[topicData.cid] = topicInfo.categoryData;
				userCache[topicData.uid] = topicInfo.user;

				if (!isTopicVisible(topicData, topicInfo)) {
					return next(null, null);
				}

				topicData.pinned = parseInt(topicData.pinned, 10) === 1;
				topicData.locked = parseInt(topicData.locked, 10) === 1;
				topicData.deleted = parseInt(topicData.deleted, 10) === 1;
				topicData.unread = !(topicInfo.hasread && parseInt(uid, 10) !== 0);
				topicData.unreplied = parseInt(topicData.postcount, 10) <= 1;

				topicData.category = topicInfo.categoryData;
				topicData.teaser = topicInfo.teaser;
				topicData.user = topicInfo.user;
				topicData.tags = topicInfo.tags;

				next(null, topicData);
			});
		}

		Topics.getTopicsData(tids, function(err, topics) {
			if (err) {
				return callback(err);
			}

			async.mapSeries(topics, loadTopicInfo, function(err, topics) {
				if(err) {
					return callback(err);
				}

				topics = topics.filter(function(topic) {
					return !!topic;
				});

				callback(null, topics);
			});
		});
	};

	Topics.getTopicWithPosts = function(tid, set, uid, start, end, reverse, callback) {
		Topics.getTopicData(tid, function(err, topicData) {
			if (err || !topicData) {
				return callback(err || new Error('[[error:no-topic]]'));
			}

			async.parallel({
				posts: function(next) {
					Topics.getTopicPosts(tid, set, start, end, uid, reverse, next);
				},
				category: function(next) {
					Topics.getCategoryData(tid, next);
				},
				pageCount: function(next) {
					Topics.getPageCount(tid, uid, next);
				},
				threadTools: function(next) {
					plugins.fireHook('filter:topic.thread_tools', [], next);
				},
				tags: function(next) {
					Topics.getTopicTagsObjects(tid, next);
				},
				mainPost: function(next) {
					Topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
						if (err) {
							return next(err);
						}
						if (!parseInt(mainPid, 10)) {
							return next(null, []);
						}
						posts.getPostsByPids([mainPid], function(err, postData) {
							if (err) {
								return next(err);
							}
							if (!Array.isArray(postData) || !postData[0]) {
								return next(null, []);
							}
							postData[0].index = 0;
							Topics.addPostData(postData, uid, next);
						});
					});
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				topicData.category = results.category;
				topicData.posts = results.mainPost.concat(results.posts);
				topicData.tags = results.tags;
				topicData.thread_tools = results.threadTools;
				topicData.pageCount = results.pageCount;
				topicData.unreplied = parseInt(topicData.postcount, 10) === 1;
				topicData.deleted = parseInt(topicData.deleted, 10) === 1;
				topicData.locked = parseInt(topicData.locked, 10) === 1;
				topicData.pinned = parseInt(topicData.pinned, 10) === 1;

				callback(null, topicData);
			});
		});
	};

	Topics.getTeasers = function(tids, callback) {

		if(!Array.isArray(tids)) {
			return callback(null, []);
		}

		async.map(tids, Topics.getTeaser, callback);
	};

	Topics.getTeaser = function(tid, callback) {
		Topics.getLatestUndeletedPid(tid, function(err, pid) {
			if (err || !pid) {
				return callback(err);
			}

			async.parallel({
				postData: function(next) {
					posts.getPostFields(pid, ['pid', 'uid', 'timestamp'], function(err, postData) {
						if (err) {
							return next(err);
						} else if(!postData || !utils.isNumber(postData.uid)) {
							return next(new Error('[[error:no-teaser]]'));
						}

						user.getUserFields(postData.uid, ['username', 'userslug', 'picture'], function(err, userData) {
							if (err) {
								return next(err);
							}
							postData.user = userData;
							next(null, postData);
						});
					});
				},
				postIndex: function(next) {
					posts.getPidIndex(pid, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				results.postData.timestamp = utils.toISOString(results.postData.timestamp);
				results.postData.index = results.postIndex;

				callback(null, results.postData);
			});
		});
	};

	Topics.getTopicField = function(tid, field, callback) {
		db.getObjectField('topic:' + tid, field, callback);
	};

	Topics.getTopicFields = function(tid, fields, callback) {
		db.getObjectFields('topic:' + tid, fields, callback);
	};

	Topics.setTopicField = function(tid, field, value, callback) {
		db.setObjectField('topic:' + tid, field, value, callback);
	};

	Topics.isLocked = function(tid, callback) {
		Topics.getTopicField(tid, 'locked', function(err, locked) {
			if(err) {
				return callback(err);
			}
			callback(null, parseInt(locked, 10) === 1);
		});
	};

	Topics.isOwner = function(tid, uid, callback) {
		Topics.getTopicField(tid, 'uid', function(err, author) {
			callback(err, parseInt(author, 10) === parseInt(uid, 10));
		});
	};

	Topics.updateTimestamp = function(tid, timestamp) {
		db.sortedSetAdd('topics:recent', timestamp, tid);
		Topics.setTopicField(tid, 'lastposttime', timestamp);
	};

	Topics.getUids = function(tid, callback) {
		Topics.getPids(tid, function(err, pids) {
			if (err) {
				return callback(err);
			}

			var keys = pids.map(function(pid) {
				return 'post:' + pid;
			});

			db.getObjectsFields(keys, ['uid'], function(err, data) {
				if (err) {
					return callback(err);
				}

				var uids = data.map(function(data) {
					return data.uid;
				}).filter(function(uid, pos, array) {
					return array.indexOf(uid) === pos;
				});

				callback(null, uids);
			});
		});
	};

}(exports));
