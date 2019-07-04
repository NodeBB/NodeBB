'use strict';

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
	Topics.getTopicsFields = async function (tids, fields) {
		if (!Array.isArray(tids) || !tids.length) {
			return [];
		}
		const keys = tids.map(tid => 'topic:' + tid);
		let topics;
		if (fields.length) {
			topics = await db.async.getObjectsFields(keys, fields);
		} else {
			topics = await db.async.getObjects(keys);
		}
		topics.forEach(topic => modifyTopic(topic, fields));
		return topics;
	};

	Topics.getTopicField = async function (tid, field) {
		const topic = await Topics.getTopicFields(tid, [field]);
		return topic ? topic[field] : null;
	};

	Topics.getTopicFields = async function (tid, fields) {
		const topics = await Topics.getTopicsFields([tid], fields);
		return topics ? topics[0] : null;
	};

	Topics.getTopicData = async function (tid) {
		const topics = await Topics.getTopicsFields([tid], []);
		return topics && topics.length ? topics[0] : null;
	};

	Topics.getTopicsData = async function (tids) {
		return await Topics.getTopicsFields(tids, []);
	};

	Topics.getCategoryData = async function (tid) {
		const cid = await Topics.getTopicField(tid, 'cid');
		return await categories.async.getCategoryData(cid);
	};

	Topics.setTopicField = async function (tid, field, value) {
		await db.async.setObjectField('topic:' + tid, field, value);
	};

	Topics.setTopicFields = async function (tid, data) {
		await db.async.setObject('topic:' + tid, data);
	};

	Topics.deleteTopicField = async function (tid, field) {
		await db.async.deleteObjectField('topic:' + tid, field);
	};

	Topics.deleteTopicFields = async function (tid, fields) {
		await db.async.deleteObjectFields('topic:' + tid, fields);
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
