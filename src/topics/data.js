'use strict';

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
		db.getObjectField('topic:' + tid, field, function (err, value) {
			if (err) {
				return callback(err);
			}

			if (field === 'title') {
				value = translator.escape(validator.escape(String(value)));
			}
			callback(null, value);
		});
	};

	Topics.getTopicFields = function (tid, fields, callback) {
		db.getObjectFields('topic:' + tid, fields, function (err, topic) {
			if (err) {
				return callback(err);
			}

			escapeTitle(topic);
			callback(null, topic);
		});
	};

	Topics.getTopicsFields = function (tids, fields, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
		var keys = tids.map(function (tid) {
			return 'topic:' + tid;
		});
		db.getObjectsFields(keys, fields, function (err, topics) {
			if (err) {
				return callback(err);
			}

			topics.forEach(escapeTitle);
			callback(null, topics);
		});
	};

	Topics.getTopicData = function (tid, callback) {
		db.getObject('topic:' + tid, function (err, topic) {
			if (err || !topic) {
				return callback(err);
			}

			modifyTopic(topic);
			callback(null, topic);
		});
	};

	Topics.getTopicsData = function (tids, callback) {
		var keys = [];

		for (var i = 0; i < tids.length; i += 1) {
			keys.push('topic:' + tids[i]);
		}

		db.getObjects(keys, function (err, topics) {
			if (err) {
				return callback(err);
			}

			topics.forEach(modifyTopic);
			callback(null, topics);
		});
	};

	function modifyTopic(topic) {
		if (!topic) {
			return;
		}

		topic.titleRaw = topic.title;
		topic.title = String(topic.title);
		escapeTitle(topic);
		topic.timestampISO = utils.toISOString(topic.timestamp);
		topic.lastposttimeISO = utils.toISOString(topic.lastposttime);
	}

	Topics.getCategoryData = function (tid, callback) {
		Topics.getTopicField(tid, 'cid', function (err, cid) {
			if (err) {
				return callback(err);
			}

			categories.getCategoryData(cid, callback);
		});
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
