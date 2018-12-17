
'use strict';

var async = require('async');
var validator = require('validator');

var _ = require('lodash');
var db = require('../database');
var meta = require('../meta');
var categories = require('../categories');
var plugins = require('../plugins');
var utils = require('../utils');
var batch = require('../batch');

module.exports = function (Topics) {
	Topics.createTags = function (tags, tid, timestamp, callback) {
		callback = callback || function () {};

		if (!Array.isArray(tags) || !tags.length) {
			return callback();
		}

		async.waterfall([
			function (next) {
				plugins.fireHook('filter:tags.filter', { tags: tags, tid: tid }, next);
			},
			function (data, next) {
				tags = _.uniq(data.tags);
				tags = tags.slice(0, meta.config.maximumTagsPerTopic || 5);
				tags = tags.map(function (tag) {
					return utils.cleanUpTag(tag, meta.config.maximumTagLength);
				}).filter(function (tag) {
					return tag && tag.length >= (meta.config.minimumTagLength || 3);
				});

				filterCategoryTags(tags, tid, next);
			},
			function (_tags, next) {
				tags = _tags;
				var keys = tags.map(function (tag) {
					return 'tag:' + tag + ':topics';
				});

				async.parallel([
					async.apply(db.setAdd, 'topic:' + tid + ':tags', tags),
					async.apply(db.sortedSetsAdd, keys, timestamp, tid),
				], function (err) {
					next(err);
				});
			},
			function (next) {
				async.each(tags, updateTagCount, next);
			},
		], callback);
	};

	function filterCategoryTags(tags, tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				categories.getTagWhitelist([cid], next);
			},
			function (tagWhitelist, next) {
				if (!Array.isArray(tagWhitelist[0]) || !tagWhitelist[0].length) {
					return next(null, tags);
				}
				const whitelistSet = new Set(tagWhitelist[0]);
				tags = tags.filter(tag => whitelistSet.has(tag));
				next(null, tags);
			},
		], callback);
	}

	Topics.createEmptyTag = function (tag, callback) {
		if (!tag) {
			return callback(new Error('[[error:invalid-tag]]'));
		}

		tag = utils.cleanUpTag(tag, meta.config.maximumTagLength);
		if (tag.length < (meta.config.minimumTagLength || 3)) {
			return callback(new Error('[[error:tag-too-short]]'));
		}

		async.waterfall([
			function (next) {
				db.isSortedSetMember('tags:topic:count', tag, next);
			},
			function (isMember, next) {
				if (isMember) {
					return next();
				}
				db.sortedSetAdd('tags:topic:count', 0, tag, next);
			},
		], callback);
	};

	Topics.updateTags = function (data, callback) {
		async.eachSeries(data, function (tagData, next) {
			db.setObject('tag:' + tagData.value, {
				color: tagData.color,
				bgColor: tagData.bgColor,
			}, next);
		}, callback);
	};

	Topics.renameTags = function (data, callback) {
		async.eachSeries(data, function (tagData, next) {
			renameTag(tagData.value, tagData.newName, next);
		}, callback);
	};

	function renameTag(tag, newTagName, callback) {
		if (!newTagName || tag === newTagName) {
			return setImmediate(callback);
		}
		async.waterfall([
			function (next) {
				Topics.createEmptyTag(newTagName, next);
			},
			function (next) {
				batch.processSortedSet('tag:' + tag + ':topics', function (tids, next) {
					async.waterfall([
						function (next) {
							db.sortedSetScores('tag:' + tag + ':topics', tids, next);
						},
						function (scores, next) {
							db.sortedSetAdd('tag:' + newTagName + ':topics', scores, tids, next);
						},
						function (next) {
							var keys = tids.map(function (tid) {
								return 'topic:' + tid + ':tags';
							});

							async.series([
								async.apply(db.sortedSetRemove, 'tag:' + tag + ':topics', tids),
								async.apply(db.setsRemove, keys, tag),
								async.apply(db.setsAdd, keys, newTagName),
							], next);
						},
					], next);
				}, next);
			},
			function (next) {
				Topics.deleteTag(tag, next);
			},
			function (next) {
				updateTagCount(newTagName, next);
			},
		], callback);
	}

	function updateTagCount(tag, callback) {
		callback = callback || function () {};
		async.waterfall([
			function (next) {
				Topics.getTagTopicCount(tag, next);
			},
			function (count, next) {
				count = count || 0;

				db.sortedSetAdd('tags:topic:count', count, tag, next);
			},
		], callback);
	}

	Topics.getTagTids = function (tag, start, stop, callback) {
		db.getSortedSetRevRange('tag:' + tag + ':topics', start, stop, callback);
	};

	Topics.getTagTopicCount = function (tag, callback) {
		db.sortedSetCard('tag:' + tag + ':topics', callback);
	};

	Topics.deleteTags = function (tags, callback) {
		if (!Array.isArray(tags) || !tags.length) {
			return callback();
		}

		async.series([
			function (next) {
				removeTagsFromTopics(tags, next);
			},
			function (next) {
				var keys = tags.map(function (tag) {
					return 'tag:' + tag + ':topics';
				});
				db.deleteAll(keys, next);
			},
			function (next) {
				db.sortedSetRemove('tags:topic:count', tags, next);
			},
			function (next) {
				db.deleteAll(tags.map(function (tag) {
					return 'tag:' + tag;
				}), next);
			},
		], function (err) {
			callback(err);
		});
	};

	function removeTagsFromTopics(tags, callback) {
		async.eachLimit(tags, 50, function (tag, next) {
			db.getSortedSetRange('tag:' + tag + ':topics', 0, -1, function (err, tids) {
				if (err || !tids.length) {
					return next(err);
				}
				var keys = tids.map(function (tid) {
					return 'topic:' + tid + ':tags';
				});

				db.setsRemove(keys, tag, next);
			});
		}, callback);
	}

	Topics.deleteTag = function (tag, callback) {
		Topics.deleteTags([tag], callback);
	};

	Topics.getTags = function (start, stop, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRangeWithScores('tags:topic:count', start, stop, next);
			},
			function (tags, next) {
				Topics.getTagData(tags, next);
			},
		], callback);
	};

	Topics.getTagData = function (tags, callback) {
		if (!tags.length) {
			return setImmediate(callback, null, []);
		}

		async.waterfall([
			function (next) {
				db.getObjects(tags.map(tag => 'tag:' + tag.value), next);
			},
			function (tagData, next) {
				tags.forEach(function (tag, index) {
					tag.valueEscaped = validator.escape(String(tag.value));
					tag.color = tagData[index] ? tagData[index].color : '';
					tag.bgColor = tagData[index] ? tagData[index].bgColor : '';
				});
				next(null, tags);
			},
		], callback);
	};

	Topics.getTopicTags = function (tid, callback) {
		db.getSetMembers('topic:' + tid + ':tags', callback);
	};

	Topics.getTopicsTags = function (tids, callback) {
		const keys = tids.map(tid => 'topic:' + tid + ':tags');
		db.getSetsMembers(keys, callback);
	};

	Topics.getTopicTagsObjects = function (tid, callback) {
		Topics.getTopicsTagsObjects([tid], function (err, data) {
			callback(err, Array.isArray(data) && data.length ? data[0] : []);
		});
	};

	Topics.getTopicsTagsObjects = function (tids, callback) {
		const sets = tids.map(tid => 'topic:' + tid + ':tags');
		var uniqueTopicTags;
		var topicTags;
		async.waterfall([
			function (next) {
				db.getSetsMembers(sets, next);
			},
			function (_topicTags, next) {
				topicTags = _topicTags;
				uniqueTopicTags = _.uniq(_.flatten(topicTags));

				var tags = uniqueTopicTags.map(tag => ({ value: tag }));

				async.parallel({
					tagData: function (next) {
						Topics.getTagData(tags, next);
					},
					counts: function (next) {
						db.sortedSetScores('tags:topic:count', uniqueTopicTags, next);
					},
				}, next);
			},
			function (results, next) {
				results.tagData.forEach(function (tag, index) {
					tag.score = results.counts[index] ? results.counts[index] : 0;
				});

				var tagData = _.zipObject(uniqueTopicTags, results.tagData);

				topicTags.forEach(function (tags, index) {
					if (Array.isArray(tags)) {
						topicTags[index] = tags.map(function (tag) { return tagData[tag]; });
						topicTags[index].sort(function (tag1, tag2) {
							return tag2.score - tag1.score;
						});
					}
				});

				next(null, topicTags);
			},
		], callback);
	};

	Topics.updateTopicTags = function (tid, tags, callback) {
		callback = callback || function () {};
		async.waterfall([
			function (next) {
				Topics.deleteTopicTags(tid, next);
			},
			function (next) {
				Topics.getTopicField(tid, 'timestamp', next);
			},
			function (timestamp, next) {
				Topics.createTags(tags, tid, timestamp, next);
			},
		], callback);
	};

	Topics.deleteTopicTags = function (tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicTags(tid, next);
			},
			function (tags, next) {
				async.series([
					function (next) {
						db.delete('topic:' + tid + ':tags', next);
					},
					function (next) {
						var sets = tags.map(function (tag) {
							return 'tag:' + tag + ':topics';
						});

						db.sortedSetsRemove(sets, tid, next);
					},
					function (next) {
						async.each(tags, function (tag, next) {
							updateTagCount(tag, next);
						}, next);
					},
				], next);
			},
		], function (err) {
			callback(err);
		});
	};

	Topics.searchTags = function (data, callback) {
		if (!data || !data.query) {
			return callback(null, []);
		}

		async.waterfall([
			function (next) {
				if (plugins.hasListeners('filter:topics.searchTags')) {
					plugins.fireHook('filter:topics.searchTags', { data: data }, next);
				} else {
					findMatches(data.query, 0, next);
				}
			},
			function (result, next) {
				plugins.fireHook('filter:tags.search', { data: data, matches: result.matches }, next);
			},
			function (result, next) {
				next(null, result.matches);
			},
		], callback);
	};

	Topics.autocompleteTags = function (data, callback) {
		if (!data || !data.query) {
			return callback(null, []);
		}

		async.waterfall([
			function (next) {
				if (plugins.hasListeners('filter:topics.autocompleteTags')) {
					plugins.fireHook('filter:topics.autocompleteTags', { data: data }, next);
				} else {
					findMatches(data.query, data.cid, next);
				}
			},
			function (result, next) {
				next(null, result.matches);
			},
		], callback);
	};

	function findMatches(query, cid, callback) {
		async.waterfall([
			function (next) {
				if (parseInt(cid, 10)) {
					categories.getTagWhitelist([cid], next);
				} else {
					setImmediate(next, null, []);
				}
			},
			function (tagWhitelist, next) {
				if (Array.isArray(tagWhitelist[0]) && tagWhitelist[0].length) {
					setImmediate(next, null, tagWhitelist[0]);
				} else {
					db.getSortedSetRevRange('tags:topic:count', 0, -1, next);
				}
			},
			function (tags, next) {
				query = query.toLowerCase();

				var matches = [];
				for (var i = 0; i < tags.length; i += 1) {
					if (tags[i].toLowerCase().startsWith(query)) {
						matches.push(tags[i]);
						if (matches.length > 19) {
							break;
						}
					}
				}

				matches = matches.sort(function (a, b) {
					return a > b;
				});
				next(null, { matches: matches });
			},
		], callback);
	}

	Topics.searchAndLoadTags = function (data, callback) {
		var searchResult = {
			tags: [],
			matchCount: 0,
			pageCount: 1,
		};

		if (!data || !data.query || !data.query.length) {
			return callback(null, searchResult);
		}
		async.waterfall([
			function (next) {
				Topics.searchTags(data, next);
			},
			function (tags, next) {
				async.parallel({
					counts: function (next) {
						db.sortedSetScores('tags:topic:count', tags, next);
					},
					tagData: function (next) {
						tags = tags.map(function (tag) {
							return { value: tag };
						});

						Topics.getTagData(tags, next);
					},
				}, next);
			},
			function (results, next) {
				results.tagData.forEach(function (tag, index) {
					tag.score = results.counts[index];
				});
				results.tagData.sort(function (a, b) {
					return b.score - a.score;
				});
				searchResult.tags = results.tagData;
				searchResult.matchCount = results.tagData.length;
				searchResult.pageCount = 1;
				next(null, searchResult);
			},
		], callback);
	};

	Topics.getRelatedTopics = function (topicData, uid, callback) {
		if (plugins.hasListeners('filter:topic.getRelatedTopics')) {
			return plugins.fireHook('filter:topic.getRelatedTopics', { topic: topicData, uid: uid }, callback);
		}

		var maximumTopics = meta.config.maximumRelatedTopics;
		if (maximumTopics === 0 || !topicData.tags || !topicData.tags.length) {
			return callback(null, []);
		}

		maximumTopics = maximumTopics || 5;

		async.waterfall([
			function (next) {
				async.map(topicData.tags, function (tag, next) {
					Topics.getTagTids(tag.value, 0, 5, next);
				}, next);
			},
			function (tids, next) {
				tids = _.shuffle(_.uniq(_.flatten(tids))).slice(0, maximumTopics);
				Topics.getTopics(tids, uid, next);
			},
			function (topics, next) {
				topics = topics.filter(function (topic) {
					return topic && !topic.deleted && parseInt(topic.uid, 10) !== parseInt(uid, 10);
				});
				next(null, topics);
			},
		], callback);
	};
};
