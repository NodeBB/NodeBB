'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../database');
var categories = require('../categories');
var utils = require('../utils');
var translator = require('../translator');

const intFields = [
	'tid', 'cid', 'uid', 'mainPid', 'postcount',
	'viewcount', 'deleted', 'locked', 'pinned',
	'timestamp', 'upvotes', 'downvotes', 'lastposttime',
];

module.exports = function (Topics) {
	Topics.getTopicsFields = function (tids, fields, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		async.waterfall([
			function (next) {
				const keys = tids.map(tid => 'topic:' + tid);
				if (fields.length) {
					db.getObjectsFields(keys, fields, next);
				} else {
					db.getObjects(keys, next);
				}
			},
			function (topics, next) {
				topics.forEach(topic => modifyTopic(topic, fields));
				next(null, topics);
			},
		], callback);
	};

	Topics.getTopicField = function (tid, field, callback) {
		Topics.getTopicFields(tid, [field], function (err, topic) {
			callback(err, topic ? topic[field] : null);
		});
	};

	Topics.getTopicFields = function (tid, fields, callback) {
		Topics.getTopicsFields([tid], fields, function (err, topics) {
			callback(err, topics ? topics[0] : null);
		});
	};

	Topics.getTopicData = function (tid, callback) {
		Topics.getTopicsFields([tid], [], function (err, topics) {
			callback(err, topics && topics.length ? topics[0] : null);
		});
	};

	Topics.getTopicsData = function (tids, callback) {
		Topics.getTopicsFields(tids, [], callback);
	};

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

function escapeTitle(topicData) {
	if (topicData) {
		if (topicData.title) {
			topicData.title = translator.escape(validator.escape(topicData.title));
		}
		if (topicData.titleRaw) {
			topicData.titleRaw = translator.escape(topicData.titleRaw);
		}
	}
}

function modifyTopic(topic, fields) {
	if (!topic) {
		return;
	}

	db.parseIntFields(topic, intFields, fields);

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

	if (topic.hasOwnProperty('upvotes') && topic.hasOwnProperty('downvotes')) {
		topic.votes = topic.upvotes - topic.downvotes;
	}
}
