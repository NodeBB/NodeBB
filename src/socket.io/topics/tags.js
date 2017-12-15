'use strict';

var async = require('async');
var db = require('../../database');
var topics = require('../../topics');
var utils = require('../../utils');

module.exports = function (SocketTopics) {
	SocketTopics.isTagAllowed = function (socket, data, callback) {
		if (!data || !utils.isNumber(data.cid) || !data.tag) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.waterfall([
			function (next) {
				db.getSortedSetRange('cid:' + data.cid + ':tag:whitelist', 0, -1, next);
			},
			function (tagWhitelist, next) {
				next(null, !tagWhitelist.length || tagWhitelist.includes(data.tag));
			},
		], callback);
	};

	SocketTopics.autocompleteTags = function (socket, data, callback) {
		topics.autocompleteTags(data, callback);
	};

	SocketTopics.searchTags = function (socket, data, callback) {
		topics.searchTags(data, callback);
	};

	SocketTopics.searchAndLoadTags = function (socket, data, callback) {
		topics.searchAndLoadTags(data, callback);
	};

	SocketTopics.loadMoreTags = function (socket, data, callback) {
		if (!data || !utils.isNumber(data.after)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var start = parseInt(data.after, 10);
		var stop = start + 99;
		async.waterfall([
			function (next) {
				topics.getTags(start, stop, next);
			},
			function (tags, next) {
				tags = tags.filter(Boolean);
				next(null, { tags: tags, nextStart: stop + 1 });
			},
		], callback);
	};
};
