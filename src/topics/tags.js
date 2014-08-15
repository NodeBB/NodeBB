
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
		tag = tag.substr(0, meta.config.maximumTagLength || 15);
		var matches = tag.match(/^[.-]*(.+?)[.-]*$/);
		if (matches && matches.length > 1) {
			tag = matches[1];
		}
		return tag;
	};

	function updateTagCount(tag, callback) {
		callback = callback || function() {};
		Topics.getTagTopicCount(tag, function(err, count) {
			if (!err) {
				db.sortedSetAdd('tags:topic:count', count, tag, callback);
			}
		});
	}

	Topics.getTagTids = function(tag, start, end, callback) {
		db.getSortedSetRevRange('tag:' + tag + ':topics', start, end, callback);
	};

	Topics.getTagTopicCount = function(tag, callback) {
		db.sortedSetCard('tag:' + tag + ':topics', callback);
	};

	Topics.deleteTag = function(tag) {
		db.delete('tag:' + tag + ':topics');
		db.sortedSetRemove('tags:topic:count', tag);
	};

	Topics.getTags = function(start, end, callback) {
		db.getSortedSetRevRangeWithScores('tags:topic:count', start, end, callback);
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

		db.getSetsMembers(sets, function(err, members) {
			if (err) {
				return callback(err);
			}

			var uniqueTags = _.uniq(_.flatten(members));

			db.sortedSetScores('tags:topic:count', uniqueTags, function(err, data) {
				if (err) {
					return callback(err);
				}

				var tagCounts = _.object(uniqueTags, data);

				members.forEach(function(tags, index) {
					if (Array.isArray(tags)) {
						members[index] = mapToObject(tags, tagCounts);
					}
				});
				callback(null, members);
			});
		});
	};

	function mapToObject(tags, tagCounts) {
		if (!tags) {
			return tags;
		}

		return tags.map(function(tag) {
			return {name: tag, score: tagCounts ? tagCounts[tag] : 0};
		});
	}

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

		if (plugins.hasListeners('filter:tags.category')) {
			plugins.fireHook('filter:tags.category', {tags: [], cid: data.cid}, function(err, result) {
				if (data.query.length === 1) {
					callback(err, result.tags);
				} else {
					doSearch(err, result ? result.tags : null);
				}
			});
		} else {
			db.getSortedSetRevRange('tags:topic:count', 0, -1, doSearch);
		}

		function doSearch(err, tags) {
			if (err) {
				return callback(null, []);
			}

			data.query = data.query.toLowerCase();
			var matches = [];
			for(var i=0; i<tags.length; ++i) {
				if (tags[i].toLowerCase().indexOf(data.query) === 0) {
					matches.push(tags[i]);
				}
			}

			matches = matches.slice(0, 10).sort(function(a, b) {
				return a > b;
			});

			callback(null, matches);
		}
	};

};