
'use strict';

var async = require('async'),
	winston = require('winston'),
	db = require('../database'),
	meta = require('../meta'),
	_ = require('underscore'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils');

module.exports = function(Topics) {

	Topics.createTags = function(tags, tid, timestamp, callback) {
		callback = callback || function () {};

		if (!Array.isArray(tags) || !tags.length) {
			return callback();
		}

		plugins.fireHook('filter:tags.filter', {tags: tags, tid: tid}, function(err, data) {
			if (err) {
				return callback(err);
			}

			tags = data.tags.slice(0, meta.config.tagsPerTopic || 5);

			async.each(tags, function(tag, next) {
				tag = Topics.cleanUpTag(tag);

				if (tag.length < (meta.config.minimumTagLength || 3)) {
					return next();
				}
				db.setAdd('topic:' + tid + ':tags', tag);

				db.sortedSetAdd('tag:' + tag + ':topics', timestamp, tid, function(err) {
					if (!err) {
						updateTagCount(tag);
					}
					next(err);
				});
			}, callback);
		});
	};

	Topics.cleanUpTag = function(tag) {
		if (typeof tag !== 'string' || !tag.length ) {
			return '';
		}
		tag = tag.trim().toLowerCase();
		tag = tag.replace(/[,\/#!$%\^\*;:{}=_`<>'"~()?\|]/g, '');
		tag = tag.substr(0, meta.config.maximumTagLength || 15).trim();
		var matches = tag.match(/^[.-]*(.+?)[.-]*$/);
		if (matches && matches.length > 1) {
			tag = matches[1];
		}
		return tag;
	};

	Topics.updateTag = function(tag, data, callback) {
		db.setObject('tag:' + tag, data, callback);
	};

	function updateTagCount(tag, callback) {
		callback = callback || function() {};
		Topics.getTagTopicCount(tag, function(err, count) {
			if (err || !count) {
				return callback(err);
			}

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
		Topics.getTopicField(tid, 'timestamp', function(err, timestamp) {
			if (err) {
				return callback(err);
			}

			Topics.deleteTopicTags(tid, function(err) {
				if (err) {
					return callback(err);
				}

				Topics.createTags(tags, tid, timestamp, callback);
			});
		});
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
			], callback);
		});
	};

	Topics.searchTags = function(data, callback) {
		if (!data) {
			return callback(null, []);
		}

		db.getSortedSetRevRange('tags:topic:count', 0, -1, function(err, tags) {
			if (err) {
				return callback(null, []);
			}
			if (data.query === '') {
				return callback(null, tags);
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
		if (!data.query || !data.query.length) {
			return callback(null, []);
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

				callback(null, results.tagData);
			});
		});
	};

};