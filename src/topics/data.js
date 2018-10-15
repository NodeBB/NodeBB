'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../database');
var categories = require('../categories');
var utils = require('../utils');
var translator = require('../translator');

function escapeTitle(topicData) {
	if (!topicData) {
		return;
	}
	if (topicData.title) {
		topicData.title = translator.escape(validator.escape(topicData.title.toString()));
	}
	if (topicData.titleRaw) {
		topicData.titleRaw = translator.escape(topicData.titleRaw);
	}
}

module.exports = function (Topics) {
	Topics.getTopicField = function (tid, field, callback) {
		async.waterfall([
			function (next) {
				db.getObjectField('topic:' + tid, field, next);
			},
			function (value, next) {
				if (field === 'title') {
					value = translator.escape(validator.escape(String(value)));
				}
				next(null, value);
			},
		], callback);
	};

	Topics.getTopicFields = function (tid, fields, callback) {
		async.waterfall([
			function (next) {
				db.getObjectFields('topic:' + tid, fields, next);
			},
			function (topic, next) {
				escapeTitle(topic);
				next(null, topic);
			},
		], callback);
	};

	Topics.getTopicsFields = function (tids, fields, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
		var keys = tids.map(function (tid) {
			return 'topic:' + tid;
		});
		async.waterfall([
			function (next) {
				if (fields.length) {
					db.getObjectsFields(keys, fields, next);
				} else {
					db.getObjects(keys, next);
				}
			},
			function (topics, next) {
				topics.forEach(modifyTopic);
				next(null, topics);
			},
		], callback);
	};

	Topics.getTopicData = function (tid, callback) {
		async.waterfall([
			function (next) {
				db.getObject('topic:' + tid, next);
			},
			function (topic, next) {
				if (!topic) {
					return next(null, null);
				}
				modifyTopic(topic);
				next(null, topic);
			},
		], callback);
	};

	Topics.getTopicsData = function (tids, callback) {
		Topics.getTopicsFields(tids, [], callback);
	};

	function modifyTopic(topic) {
		if (!topic) {
			return;
		}
		if (topic.hasOwnProperty('title')) {
			topic.titleRaw = topic.title;
			topic.title = String(topic.title);
		}

		escapeTitle(topic);
		if (topic.hasOwnProperty('timestamp')) {
			topic.timestampISO = utils.toISOString(topic.timestamp);
		}
		if (topic.hasOwnProperty('lastposttime')) {
			topic.lastposttimeISO = utils.toISOString(topic.lastposttime);
		}

		if (topic.hasOwnProperty('upvotes')) {
			topic.upvotes = parseInt(topic.upvotes, 10) || 0;
		}
		if (topic.hasOwnProperty('upvotes')) {
			topic.downvotes = parseInt(topic.downvotes, 10) || 0;
		}
		if (topic.hasOwnProperty('upvotes') && topic.hasOwnProperty('downvotes')) {
			topic.votes = topic.upvotes - topic.downvotes;
		}
	}

	Topics.getCategoryData = function (tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				categories.getCategoryData(cid, next);
			},
		], callback);
	};

	Topics.setTopicField = function (tid, field, value, callback) {
		db.setObjectField('topic:' + tid, field, value, callback);
	};

	Topics.setTopicFields = function (tid, data, callback) {
		callback = callback || function () {};
		db.setObject('topic:' + tid, data, callback);
	};

	Topics.deleteTopicField = function (tid, field, callback) {
		db.deleteObjectField('topic:' + tid, field, callback);
	};

	Topics.deleteTopicFields = function (tid, fields, callback) {
		db.deleteObjectFields('topic:' + tid, fields, callback);
	};
};
