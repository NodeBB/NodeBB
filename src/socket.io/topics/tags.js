'use strict';

var topics = require('../../topics');
var utils = require('../../../public/src/utils');

module.exports = function(SocketTopics) {
	SocketTopics.searchTags = function(socket, data, callback) {
		topics.searchTags(data, callback);
	};

	SocketTopics.searchAndLoadTags = function(socket, data, callback) {
		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		topics.searchAndLoadTags(data, callback);
	};

	SocketTopics.loadMoreTags = function(socket, data, callback) {
		if (!data || !utils.isNumber(data.after)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var start = parseInt(data.after, 10);
		var stop = start + 99;

		topics.getTags(start, stop, function(err, tags) {
			if (err) {
				return callback(err);
			}
			tags = tags.filter(function(tag) {
				return tag && tag.score > 0;
			});
			callback(null, {tags: tags, nextStart: stop + 1});
		});
	};
};
