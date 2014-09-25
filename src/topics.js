"use strict";

var async = require('async'),
	winston = require('winston'),
	validator = require('validator'),

	_ = require('underscore'),
	db = require('./database'),
	posts = require('./posts'),
	utils = require('../public/src/utils'),
	plugins = require('./plugins'),
	user = require('./user'),
	categories = require('./categories'),
	privileges = require('./privileges');

(function(Topics) {

	require('./topics/create')(Topics);
	require('./topics/delete')(Topics);
	require('./topics/unread')(Topics);
	require('./topics/recent')(Topics);
	require('./topics/popular')(Topics);
	require('./topics/fork')(Topics);
	require('./topics/posts')(Topics);
	require('./topics/follow')(Topics);
	require('./topics/tags')(Topics);

	Topics.getTopicData = function(tid, callback) {
		db.getObject('topic:' + tid, function(err, topic) {
			if (err || !topic) {
				return callback(err);
			}
			topic.title = validator.escape(topic.title);
			topic.relativeTime = utils.toISOString(topic.timestamp);
			callback(null, topic);
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

		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, returnTopics);
		}

		privileges.topics.filter('read', tids, uid, function(err, tids) {
			if (err) {
				return callback(err);
			}

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
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		Topics.getTopicsData(tids, function(err, topics) {
			function mapFilter(array, field) {
				return array.map(function(topic) {
					return topic && topic[field];
				}).filter(function(value, index, array) {
					return utils.isNumber(value) && array.indexOf(value) === index;
				});
			}

			if (err) {
				return callback(err);
			}

			var uids = mapFilter(topics, 'uid');
			var cids = mapFilter(topics, 'cid');

			async.parallel({
				users: function(next) {
					user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
				},
				categories: function(next) {
					categories.getMultipleCategoryFields(cids, ['cid', 'name', 'slug', 'icon', 'bgColor', 'color', 'disabled'], next);
				},
				hasRead: function(next) {
					Topics.hasReadTopics(tids, uid, next);
				},
				isAdminOrMod: function(next) {
					privileges.categories.isAdminOrMod(cids, uid, next);
				},
				teasers: function(next) {
					Topics.getTeasers(tids, uid, next);
				},
				tags: function(next) {
					Topics.getTopicsTagsObjects(tids, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var users = _.object(uids, results.users);
				var categories = _.object(cids, results.categories);
				var isAdminOrMod = {};
				cids.forEach(function(cid, index) {
					isAdminOrMod[cid] = results.isAdminOrMod[index];
				});

				for (var i=0; i<topics.length; ++i) {
					if (topics[i]) {
						topics[i].category = categories[topics[i].cid];
						topics[i].category.disabled = parseInt(topics[i].category.disabled, 10) === 1;
						topics[i].user = users[topics[i].uid];
						topics[i].teaser = results.teasers[i];
						topics[i].tags = results.tags[i];

						topics[i].pinned = parseInt(topics[i].pinned, 10) === 1;
						topics[i].locked = parseInt(topics[i].locked, 10) === 1;
						topics[i].deleted = parseInt(topics[i].deleted, 10) === 1;
						topics[i].unread = !(results.hasRead[i] && parseInt(uid, 10) !== 0);
						topics[i].unreplied = parseInt(topics[i].postcount, 10) <= 1;
					}
				}

				topics = topics.filter(function(topic) {
					return topic &&	!topic.category.disabled &&
						(!topic.deleted || (topic.deleted && isAdminOrMod[topic.cid]) ||
						parseInt(topic.uid, 10) === parseInt(uid, 10));
				});

				plugins.fireHook('filter:topics.get', {topics: topics, uid: uid}, function(err, topicData) {
					callback(err, topicData.topics)
				});
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
					posts.getPidsFromSet(set, start, end, reverse, function(err, pids) {
						if (err) {
							return next(err);
						}

						pids = topicData.mainPid ? [topicData.mainPid].concat(pids) : pids;
						if (!pids.length) {
							return next(null, []);
						}
						posts.getPostsByPids(pids, uid, function(err, posts) {
							if (err) {
								return next(err);
							}

							Topics.addPostData(posts, uid, next);
						});
					});
 				},
				category: function(next) {
					Topics.getCategoryData(tid, next);
				},
				threadTools: function(next) {
					plugins.fireHook('filter:topic.thread_tools', [], next);
				},
				tags: function(next) {
					Topics.getTopicTagsObjects(tid, next);
				},
				isFollowing: function(next) {
					Topics.isFollowing(tid, uid, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				topicData.posts = results.posts;
				topicData.category = results.category;
				topicData.thread_tools = results.threadTools;
				topicData.tags = results.tags;
				topicData.isFollowing = results.isFollowing;

				topicData.unreplied = parseInt(topicData.postcount, 10) === 1;
				topicData.deleted = parseInt(topicData.deleted, 10) === 1;
				topicData.locked = parseInt(topicData.locked, 10) === 1;
				topicData.pinned = parseInt(topicData.pinned, 10) === 1;

				plugins.fireHook('filter:topic.get', topicData, callback);
			});
		});
	};

	Topics.getMainPost = function(tid, uid, callback) {
		Topics.getMainPosts([tid], uid, function(err, mainPosts) {
			callback(err, Array.isArray(mainPosts) && mainPosts.length ? mainPosts[0] : null);
		});
	};

	Topics.getMainPosts = function(tids, uid, callback) {
		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});

		db.getObjectsFields(keys, ['mainPid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			var mainPids = topicData.map(function(topic) {
				return topic ? topic.mainPid : null;
			});

			posts.getPostsByPids(mainPids, uid, function(err, postData) {
				if (err) {
					return callback(err);
				}

				if (!Array.isArray(postData) || !postData.length) {
					return callback(null, []);
				}

				Topics.addPostData(postData, uid, callback);
			});
		});
	};

	Topics.getTeasers = function(tids, uid, callback) {
		if(!Array.isArray(tids)) {
			return callback(null, []);
		}

		async.map(tids, function(tid, next) {
			db.getSortedSetRevRange('tid:' + tid + ':posts', 0, 0, function(err, data) {
				next(err, Array.isArray(data) && data.length ? data[0] : null);
			});
		}, function(err, pids) {
			if (err) {
				return callback(err);
			}

			var postKeys = pids.filter(Boolean).map(function(pid) {
				return 'post:' + pid;
			});

			db.getObjectsFields(postKeys, ['pid', 'uid', 'timestamp', 'tid'], function(err, postData) {
				if (err) {
					return callback(err);
				}

				var uids = postData.map(function(post) {
					return post.uid;
				}).filter(function(uid, index, array) {
					return array.indexOf(uid) === index;
				});

				async.parallel({
					users: function(next) {
						user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
					},
					indices: function(next) {
						posts.getPostIndices(postData, uid, next);
					}
				}, function(err, results) {
					if (err) {
						return callback(err);
					}

					var users = {};
					results.users.forEach(function(user) {
						users[user.uid] = user;
					});
					var tidToPost = {};
					postData.forEach(function(post, index) {
						post.user = users[post.uid];
						post.index = results.indices[index] + 1;
						post.timestamp = utils.toISOString(post.timestamp);
						tidToPost[post.tid] = post;
					});

					var teasers = tids.map(function(tid) {
						return tidToPost[tid];
					});

					callback(null, teasers);
				});
			});
		});
	};

	Topics.getTeaser = function(tid, uid, callback) {
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
							return callback();
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
					posts.getPidIndex(pid, uid, next);
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

	Topics.getTopicsFields = function(tids, fields, callback) {
		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});
		db.getObjectsFields(keys, fields, callback);
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
		uid = parseInt(uid, 10);
		if (!uid) {
			return callback(null, false);
		}
		Topics.getTopicField(tid, 'uid', function(err, author) {
			callback(err, parseInt(author, 10) === uid);
		});
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

	Topics.search = function(tid, term, callback) {
		if (plugins.hasListeners('filter:topic.search')) {
			plugins.fireHook('filter:topic.search', {
				tid: tid,
				term: term
			}, callback);
		} else {
			callback(new Error('no-plugins-available'), []);
		}
	};

}(exports));
