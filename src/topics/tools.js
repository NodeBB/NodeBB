'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var categories = require('../categories');
var plugins = require('../plugins');
var privileges = require('../privileges');


module.exports = function (Topics) {
	var topicTools = {};
	Topics.tools = topicTools;

	topicTools.delete = function (tid, uid, callback) {
		toggleDelete(tid, uid, true, callback);
	};

	topicTools.restore = function (tid, uid, callback) {
		toggleDelete(tid, uid, false, callback);
	};

	function toggleDelete(tid, uid, isDelete, callback) {
		var topicData;
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				privileges.topics.canDelete(tid, uid, next);
			},
			function (canDelete, next) {
				if (!canDelete) {
					return next(new Error('[[error:no-privileges]]'));
				}
				Topics.getTopicFields(tid, ['tid', 'cid', 'uid', 'deleted', 'title', 'mainPid'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;

				if (parseInt(topicData.deleted, 10) === 1 && isDelete) {
					return callback(new Error('[[error:topic-already-deleted]]'));
				} else if (parseInt(topicData.deleted, 10) !== 1 && !isDelete) {
					return callback(new Error('[[error:topic-already-restored]]'));
				}

				Topics[isDelete ? 'delete' : 'restore'](tid, uid, next);
			},
			function (next) {
				categories.updateRecentTidForCid(topicData.cid, next);
			},
			function (next) {
				topicData.deleted = isDelete ? 1 : 0;

				if (isDelete) {
					plugins.fireHook('action:topic.delete', { topic: topicData, uid: uid });
				} else {
					plugins.fireHook('action:topic.restore', { topic: topicData, uid: uid });
				}

				var data = {
					tid: tid,
					cid: topicData.cid,
					isDelete: isDelete,
					uid: uid,
				};

				next(null, data);
			},
		], callback);
	}

	topicTools.purge = function (tid, uid, callback) {
		var cid;
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return callback();
				}
				privileges.topics.canPurge(tid, uid, next);
			},
			function (canPurge, next) {
				if (!canPurge) {
					return next(new Error('[[error:no-privileges]]'));
				}

				Topics.getTopicField(tid, 'cid', next);
			},
			function (_cid, next) {
				cid = _cid;

				Topics.purgePostsAndTopic(tid, uid, next);
			},
			function (next) {
				next(null, { tid: tid, cid: cid, uid: uid });
			},
		], callback);
	};

	topicTools.lock = function (tid, uid, callback) {
		toggleLock(tid, uid, true, callback);
	};

	topicTools.unlock = function (tid, uid, callback) {
		toggleLock(tid, uid, false, callback);
	};

	function toggleLock(tid, uid, lock, callback) {
		callback = callback || function () {};

		var topicData;

		async.waterfall([
			function (next) {
				Topics.getTopicFields(tid, ['tid', 'uid', 'cid'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				if (!topicData || !topicData.cid) {
					return next(new Error('[[error:no-topic]]'));
				}
				privileges.categories.isAdminOrMod(topicData.cid, uid, next);
			},
			function (isAdminOrMod, next) {
				if (!isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				Topics.setTopicField(tid, 'locked', lock ? 1 : 0, next);
			},
			function (next) {
				topicData.isLocked = lock;

				plugins.fireHook('action:topic.lock', { topic: _.clone(topicData), uid: uid });

				next(null, topicData);
			},
		], callback);
	}

	topicTools.pin = function (tid, uid, callback) {
		togglePin(tid, uid, true, callback);
	};

	topicTools.unpin = function (tid, uid, callback) {
		togglePin(tid, uid, false, callback);
	};

	function togglePin(tid, uid, pin, callback) {
		var topicData;
		async.waterfall([
			function (next) {
				Topics.getTopicData(tid, next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				if (!topicData) {
					return callback(new Error('[[error:no-topic]]'));
				}
				privileges.categories.isAdminOrMod(_topicData.cid, uid, next);
			},
			function (isAdminOrMod, next) {
				if (!isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				async.parallel([
					async.apply(Topics.setTopicField, tid, 'pinned', pin ? 1 : 0),
					function (next) {
						if (pin) {
							async.parallel([
								async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids:pinned', Date.now(), tid),
								async.apply(db.sortedSetRemove, 'cid:' + topicData.cid + ':tids', tid),
								async.apply(db.sortedSetRemove, 'cid:' + topicData.cid + ':tids:posts', tid),
								async.apply(db.sortedSetRemove, 'cid:' + topicData.cid + ':tids:votes', tid),
							], next);
						} else {
							async.parallel([
								async.apply(db.sortedSetRemove, 'cid:' + topicData.cid + ':tids:pinned', tid),
								async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids', topicData.lastposttime, tid),
								async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids:posts', topicData.postcount, tid),
								async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids:votes', parseInt(topicData.votes, 10) || 0, tid),
							], next);
						}
					},
				], next);
			},
			function (results, next) {
				topicData.isPinned = pin;

				plugins.fireHook('action:topic.pin', { topic: _.clone(topicData), uid: uid });

				next(null, topicData);
			},
		], callback);
	}

	topicTools.orderPinnedTopics = function (uid, data, callback) {
		var cid;
		async.waterfall([
			function (next) {
				var tids = data.map(function (topic) {
					return topic && topic.tid;
				});
				Topics.getTopicsFields(tids, ['cid'], next);
			},
			function (topicData, next) {
				var uniqueCids = _.uniq(topicData.map(function (topicData) {
					return topicData && parseInt(topicData.cid, 10);
				}));

				if (uniqueCids.length > 1 || !uniqueCids.length || !uniqueCids[0]) {
					return next(new Error('[[error:invalid-data]]'));
				}
				cid = uniqueCids[0];

				privileges.categories.isAdminOrMod(cid, uid, next);
			},
			function (isAdminOrMod, next) {
				if (!isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}
				async.eachSeries(data, function (topicData, next) {
					async.waterfall([
						function (next) {
							db.isSortedSetMember('cid:' + cid + ':tids:pinned', topicData.tid, next);
						},
						function (isPinned, next) {
							if (isPinned) {
								db.sortedSetAdd('cid:' + cid + ':tids:pinned', topicData.order, topicData.tid, next);
							} else {
								setImmediate(next);
							}
						},
					], next);
				}, next);
			},
		], callback);
	};

	topicTools.move = function (tid, data, callback) {
		var topic;
		var oldCid;
		var cid = data.cid;

		async.waterfall([
			function (next) {
				Topics.getTopicData(tid, next);
			},
			function (topicData, next) {
				topic = topicData;
				if (!topic) {
					return next(new Error('[[error:no-topic]]'));
				}
				if (parseInt(cid, 10) === parseInt(topic.cid, 10)) {
					return next(new Error('[[error:cant-move-topic-to-same-category]]'));
				}
				db.sortedSetsRemove([
					'cid:' + topicData.cid + ':tids',
					'cid:' + topicData.cid + ':tids:pinned',
					'cid:' + topicData.cid + ':tids:posts',
					'cid:' + topicData.cid + ':tids:votes',
					'cid:' + topicData.cid + ':tids:lastposttime',
					'cid:' + topicData.cid + ':recent_tids',
					'cid:' + topicData.cid + ':uid:' + topicData.uid + ':tids',
				], tid, next);
			},
			function (next) {
				db.sortedSetAdd('cid:' + cid + ':tids:lastposttime', topic.lastposttime, tid, next);
			},
			function (next) {
				db.sortedSetAdd('cid:' + cid + ':uid:' + topic.uid + ':tids', topic.timestamp, tid, next);
			},
			function (next) {
				if (parseInt(topic.pinned, 10)) {
					db.sortedSetAdd('cid:' + cid + ':tids:pinned', Date.now(), tid, next);
				} else {
					async.parallel([
						function (next) {
							db.sortedSetAdd('cid:' + cid + ':tids', topic.lastposttime, tid, next);
						},
						function (next) {
							topic.postcount = topic.postcount || 0;
							db.sortedSetAdd('cid:' + cid + ':tids:posts', topic.postcount, tid, next);
						},
						function (next) {
							var votes = (parseInt(topic.upvotes, 10) || 0) - (parseInt(topic.downvotes, 10) || 0);
							db.sortedSetAdd('cid:' + cid + ':tids:votes', votes, tid, next);
						},
					], function (err) {
						next(err);
					});
				}
			},
			function (next) {
				oldCid = topic.cid;
				categories.moveRecentReplies(tid, oldCid, cid, next);
			},
			function (next) {
				async.parallel([
					function (next) {
						categories.incrementCategoryFieldBy(oldCid, 'topic_count', -1, next);
					},
					function (next) {
						categories.incrementCategoryFieldBy(cid, 'topic_count', 1, next);
					},
					function (next) {
						categories.updateRecentTid(cid, tid, next);
					},
					function (next) {
						categories.updateRecentTidForCid(oldCid, next);
					},
					function (next) {
						Topics.setTopicFields(tid, {
							cid: cid,
							oldCid: oldCid,
						}, next);
					},
				], function (err) {
					next(err);
				});
			},
			function (next) {
				var hookData = _.clone(data);
				hookData.fromCid = oldCid;
				hookData.toCid = cid;
				hookData.tid = tid;
				plugins.fireHook('action:topic.move', hookData);
				next();
			},
		], callback);
	};
};
