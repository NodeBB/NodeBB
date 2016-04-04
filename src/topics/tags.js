
'use strict';

var async = require('async');

var db = require('../database');
var meta = require('../meta');
var _ = require('underscore');
var plugins = require('../plugins');
var utils = require('../../public/src/utils');


module.exports = function(Topics) {

	Topics.createTags = function(tags, tid, timestamp, callback) {
		callback = callback || function () {};

		if (!Array.isArray(tags) || !tags.length) {
			return callback();
		}

		async.waterfall([
			function (next) {
				plugins.fireHook('filter:tags.filter', {tags: tags, tid: tid}, next);
			},
			function (data, next) {
				tags = data.tags.slice(0, meta.config.maximumTagsPerTopic || 5);
				tags = tags.map(function(tag) {
					return utils.cleanUpTag(tag, meta.config.maximumTagLength);
				}).filter(function(tag, index, array) {
					return tag && tag.length >= (meta.config.minimumTagLength || 3) && array.indexOf(tag) === index;
				});

				var keys = tags.map(function(tag) {
					return 'tag:' + tag + ':topics';
				});

				async.parallel([
					async.apply(db.setAdd, 'topic:' + tid + ':tags', tags),
					async.apply(db.sortedSetsAdd, keys, timestamp, tid)
				], function(err) {
					if (err) {
						return next(err);
					}
					async.each(tags, updateTagCount, next);
				});
			}
		], callback);
	};

	Topics.updateTag = function(tag, data, callback) {
		db.setObject('tag:' + tag, data, callback);
	};

	function updateTagCount(tag, callback) {
		callback = callback || function() {};
		Topics.getTagTopicCount(tag, function(err, count) {
			if (err) {
				return callback(err);
			}
			count = count || 0;

			db.sortedSetAdd('tags:topic:count', count, tag, callback);
		});
	}

	Topics.getTagTids = function(tag, start, stop, callback) {
		db.getSortedSetRevRange('tag:' + tag + ':topics', start, stop, callback);
	};

	Topics.getTagTopicCount = function(tag, callback) {
		db.sortedSetCard('tag:' + tag + ':topics', callback);
	};

	Topics.deleteTags = function(tags, callback) {
		if (!Array.isArray(tags) || !tags.length) {
			return callback();
		}

		async.series([
			function(next) {
				removeTagsFromTopics(tags, next);
			},
			function(next) {
				var keys = tags.map(function(tag) {
					return 'tag:' + tag + ':topics';
				});
				db.deleteAll(keys, next);
			},
			function(next) {
				db.sortedSetRemove('tags:topic:count', tags, next);
			}
		], callback);
	};

	function removeTagsFromTopics(tags, callback) {
		async.eachLimit(tags, 50, function(tag, next) {
			db.getSortedSetRange('tag:' + tag + ':topics', 0, -1, function(err, tids) {
				if (err || !tids.length) {
					return next(err);
				}
				var keys = tids.map(function(tid) {
					return 'topic:' + tid + ':tags';
				});

				db.setsRemove(keys, tag, next);
			});
		}, callback);
	}

	Topics.deleteTag = function(tag) {
		db.delete('tag:' + tag + ':topics');
		db.sortedSetRemove('tags:topic:count', tag);
	};

	Topics.getTags = function(start, stop, callback) {
		db.getSortedSetRevRangeWithScores('tags:topic:count', start, stop, function(err, tags) {
			if (err) {
				return callback(err);
			}

			Topics.getTagData(tags, callback);
		});
	};

	Topics.getTagData = function(tags, callback) {
		var keys = tags.map(function(tag) {
			return 'tag:' + tag.value;
		});

		db.getObjects(keys, function(err, tagData) {
			if (err) {
				return callback(err);
			}

			tags.forEach(function(tag, index) {
				tag.color = tagData[index] ? tagData[index].color : '';
				tag.bgColor = tagData[index] ? tagData[index].bgColor : '';
			});
			callback(null, tags);
		});
	};

	Topics.getTopicTags = function(tid, callback) {
		db.getSetMembers('topic:' + tid + ':tags', callback);
	};

	Topics.getTopicTagsObjects = function(tid, callback) {
		Topics.getTopicsTagsObjects([tid], function(err, data) {
			callback(err, Array.isArray(data) && data.length ? data[0] : []);
		});
	};

	Topics.getTopicsTagsObjects = function(tids, callback) {
		var sets = tids.map(function(tid) {
			return 'topic:' + tid + ':tags';
		});

		db.getSetsMembers(sets, function(err, topicTags) {
			if (err) {
				return callback(err);
			}

			var uniqueTopicTags = _.uniq(_.flatten(topicTags));

			var tags = uniqueTopicTags.map(function(tag) {
				return {value: tag};
			});

			async.parallel({
				tagData: function(next) {
					Topics.getTagData(tags, next);
				},
				counts: function(next) {
					db.sortedSetScores('tags:topic:count', uniqueTopicTags, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				results.tagData.forEach(function(tag, index) {
					tag.score = results.counts[index] ? results.counts[index] : 0;
				});

				var tagData = _.object(uniqueTopicTags, results.tagData);

				topicTags.forEach(function(tags, index) {
					if (Array.isArray(tags)) {
						topicTags[index] = tags.map(function(tag) {return tagData[tag];});
					}
				});

				callback(null, topicTags);
			});
		});
	};

	Topics.updateTags = function(tid, tags, callback) {
		callback = callback || function() {};
		async.waterfall([
			function(next) {
				Topics.deleteTopicTags(tid, next);
			},
			function(next) {
				Topics.getTopicField(tid, 'timestamp', next);
			},
			function(timestamp, next) {
				Topics.createTags(tags, tid, timestamp, next);
			}
		], callback);
	};

	Topics.deleteTopicTags = function(tid, callback) {
		Topics.getTopicTags(tid, function(err, tags) {
			if (err) {
				return callback(err);
			}

			async.series([
				function(next) {
					db.delete('topic:' + tid + ':tags', next);
				},
				function(next) {
					var sets = tags.map(function(tag) {
						return 'tag:' + tag + ':topics';
					});

					db.sortedSetsRemove(sets, tid, next);
				},
				function(next) {
					async.each(tags, function(tag, next) {
						updateTagCount(tag, next);
					}, next);
				}
			], function(err, results) {
				callback(err);
			});
		});
	};

	Topics.searchTags = function(data, callback) {
		if (!data || !data.query) {
			return callback(null, []);
		}

		db.getSortedSetRevRange('tags:topic:count', 0, -1, function(err, tags) {
			if (err) {
				return callback(null, []);
			}

			data.query = data.query.toLowerCase();

			var matches = [];
			for(var i=0; i<tags.length; ++i) {
				if (tags[i].toLowerCase().startsWith(data.query)) {
					matches.push(tags[i]);
				}
			}

			matches = matches.slice(0, 20).sort(function(a, b) {
				return a > b;
			});

			plugins.fireHook('filter:tags.search', {data: data, matches: matches}, function(err, data) {
				callback(err, data ? data.matches : []);
			});
		});
	};

	Topics.searchAndLoadTags = function(data, callback) {
		var searchResult = {
			tags: [],
			matchCount: 0,
			pageCount: 1
		};

		if (!data.query || !data.query.length) {
			return callback(null, searchResult);
		}
		Topics.searchTags(data, function(err, tags) {
			if (err) {
				return callback(err);
			}
			async.parallel({
				counts: function(next) {
					db.sortedSetScores('tags:topic:count', tags, next);
				},
				tagData: function(next) {
					tags = tags.map(function(tag) {
						return {value: tag};
					});

					Topics.getTagData(tags, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
				results.tagData.forEach(function(tag, index) {
					tag.score = results.counts[index];
				});
				results.tagData.sort(function(a, b) {
					return b.score - a.score;
				});
				searchResult.tags = results.tagData;
				searchResult.matchCount = results.tagData.length;
				searchResult.pageCount = 1;
				callback(null, searchResult);
			});
		});
	};

	Topics.getRelatedTopics = function(topicData, uid, callback) {
		if (plugins.hasListeners('filter:topic.getRelatedTopics')) {
			return plugins.fireHook('filter:topic.getRelatedTopics', {topic: topicData, uid: uid}, callback);
		}

		var maximumTopics = parseInt(meta.config.maximumRelatedTopics, 10);
		if (maximumTopics === 0 || !topicData.tags.length) {
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
				tids = _.shuffle(_.unique(_.flatten(tids))).slice(0, maximumTopics);
				Topics.getTopics(tids, uid, next);
			},
			function (topics, next) {
				topics = topics.filter(function(topic) {
					return topic && !topic.deleted && parseInt(topic.uid, 10) !== parseInt(uid, 10);
				});
				next(null, topics);
			}
		], callback);
	};
};