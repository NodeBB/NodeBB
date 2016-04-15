'use strict';

var validator = require('validator');

var db = require('../database');
var categories = require('../categories');
var utils = require('../../public/src/utils');

module.exports = function(Topics) {

	Topics.getTopicField = function(tid, field, callback) {
		db.getObjectField('topic:' + tid, field, callback);
	};

	Topics.getTopicFields = function(tid, fields, callback) {
		db.getObjectFields('topic:' + tid, fields, callback);
	};

	Topics.getTopicsFields = function(tids, fields, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});
		db.getObjectsFields(keys, fields, callback);
	};

	Topics.getTopicData = function(tid, callback) {
		db.getObject('topic:' + tid, function(err, topic) {
			if (err || !topic) {
				return callback(err);
			}

			modifyTopic(topic);
			callback(null, topic);
		});
	};

	Topics.getTopicsData = function(tids, callback) {
		var keys = [];

		for (var i=0; i<tids.length; ++i) {
			keys.push('topic:' + tids[i]);
		}

		db.getObjects(keys, function(err, topics) {
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
		topic.title = validator.escape(String(topic.title));
		topic.timestampISO = utils.toISOString(topic.timestamp);
		topic.lastposttimeISO = utils.toISOString(topic.lastposttime);
	}

	Topics.getCategoryData = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			categories.getCategoryData(cid, callback);
		});
	};

	Topics.setTopicField = function(tid, field, value, callback) {
		db.setObjectField('topic:' + tid, field, value, callback);
	};

	Topics.deleteTopicField = function(tid, field, callback) {
		db.deleteObjectField('topic:' + tid, field, callback);
	};

};