
'use strict';

var async = require('async'),
	db = require('../database'),
	meta = require('../meta'),
	utils = require('../../public/src/utils');

module.exports = function(Topics) {

	Topics.createTags = function(tags, tid, timestamp, callback) {
		callback = callback || function () {};

		if (!Array.isArray(tags) || !tags.length) {
			return callback();
		}

		tags = tags.slice(0, meta.config.tagsPerTopic || 5);

		async.each(tags, function(tag, next) {
			tag = cleanUpTag(tag);

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
	};

	function cleanUpTag(tag) {
		if (typeof tag !== 'string' || !tag.length ) {
			return '';
		}
		tag = tag.trim().toLowerCase();
		tag = tag.replace(/[,\/#!$%\^&\*;:{}=_`<>'"~()?\|]/g, '');
		tag = tag.substr(0, meta.config.maximumTagLength || 15);
		var matches = tag.match(/^[.-]*(.+?)[.-]*$/);
		if (matches && matches.length > 1) {
			tag = matches[1];
		}
		return tag;
	}

	function updateTagCount(tag) {
		Topics.getTagTopicCount(tag, function(err, count) {
			if (!err) {
				db.sortedSetAdd('tags:topic:count', count, tag);
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

	//returns tags as objects cuz templates.js cant do arrays yet >_>
	Topics.getTopicTagsObjects = function(tid, callback) {
		Topics.getTopicTags(tid, function(err, tags) {
			callback(err, mapToObject(tags));
		});
	};

	function mapToObject(tags) {
		if (!tags) {
			return tags;
		}
		return tags.map(function(tag) {
			return {name: tag};
		});
	}

	Topics.updateTags = function(tid, tags) {
		Topics.getTopicField(tid, 'timestamp', function(err, timestamp) {
			if (!err) {
				Topics.deleteTopicTags(tid, function(err) {
					if (!err) {
						Topics.createTags(tags, tid, timestamp);
					}
				});
			}
		});
	};

	Topics.deleteTopicTags = function(tid, callback) {
		Topics.getTopicTags(tid, function(err, tags) {
			if (err) {
				return callback(err);
			}

			async.parallel([
				function(next) {
					db.delete('topic:' + tid + ':tags', next);
				},
				function(next) {
					var sets = tags.map(function(tag) {
						return 'tag:' + tag + ':topics';
					});

					db.sortedSetsRemove(sets, tid, next);
				}
			], callback);
		});
	};

	Topics.searchTags = function(query, callback) {
		if (!query || query.length === 0) {
			return callback(null, []);
		}

		db.getSortedSetRevRange('tags:topic:count', 0, -1, function(err, tags) {
			if (err) {
				return callback(null, []);
			}

			query = query.toLowerCase();
			var matches = [];
			for(var i=0; i<tags.length; ++i) {
				if (tags[i].toLowerCase().indexOf(query) === 0) {
					matches.push(tags[i]);
				}
			}

			matches = matches.slice(0, 10).sort(function(a, b) {
				return a > b;
			});

			callback(null, matches);
		});
	};

};