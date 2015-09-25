'use strict';

var async = require('async');
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
			modifyTopic(topic, callback);
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
			async.map(topics, modifyTopic, callback);
		});
	};

	function modifyTopic(topic, callback) {
		if (!topic) {
			return callback(null, topic);
		}
		topic.title = validator.escape(topic.title);
		topic.relativeTime = utils.toISOString(topic.timestamp);
		topic.lastposttimeISO = utils.toISOString(topic.lastposttime);
		callback(null, topic);
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

};