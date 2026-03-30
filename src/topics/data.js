'use strict';

const validator = require('validator');

const db = require('../database');
const categories = require('../categories');
const utils = require('../utils');
const translator = require('../translator');
const plugins = require('../plugins');

const intFields = [
	'tid', 'cid', 'uid', 'mainPid', 'postcount',
	'viewcount', 'postercount', 'followercount',
	'deleted', 'locked', 'pinned', 'pinExpiry',
	'timestamp', 'upvotes', 'downvotes',
	'lastposttime', 'deleterUid', 'generatedTitle',
];

module.exports = function (Topics) {
	Topics.getTopicsFields = async function (tids, fields) {
		if (!Array.isArray(tids) || !tids.length) {
			return [];
		}

		// "scheduled" is derived from "timestamp"
		if (fields.includes('scheduled') && !fields.includes('timestamp')) {
			fields.push('timestamp');
		}

		const keys = tids.map(tid => `topic:${tid}`);
		const topics = await db.getObjects(keys, fields);
		const result = await plugins.hooks.fire('filter:topic.getFields', {
			tids: tids,
			topics: topics,
			fields: fields,
			keys: keys,
		});
		result.topics.forEach(topic => modifyTopic(topic, fields));
		return result.topics;
	};

	Topics.getTopicField = async function (tid, field) {
		const topic = await Topics.getTopicFields(tid, [field]);
		return topic && topic.hasOwnProperty(field) ? topic[field] : null;
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
		return await categories.getCategoryData(cid);
	};

	Topics.setTopicField = async function (tid, field, value) {
		await db.setObjectField(`topic:${tid}`, field, value);
	};

	Topics.setTopicFields = async function (tid, data) {
		await db.setObject(`topic:${tid}`, data);
	};

	Topics.deleteTopicField = async function (tid, field) {
		await db.deleteObjectField(`topic:${tid}`, field);
	};

	Topics.deleteTopicFields = async function (tid, fields) {
		await db.deleteObjectFields(`topic:${tid}`, fields);
	};
};

function escapeTitle(topicData, hasField) {
	if (topicData) {
		if (hasField('title')) {
			topicData.title = translator.escape(validator.escape(topicData.title));
			topicData.titleRaw = translator.escape(topicData.titleRaw || '');
		}
	}
}

function modifyTopic(topic, fields) {
	if (!topic) {
		return;
	}

	const hasField = utils.createFieldChecker(fields);

	db.parseIntFields(topic, intFields, fields);

	if (hasField('title')) {
		topic.titleRaw = topic.title;
		topic.title = String(topic.title);
	}

	escapeTitle(topic, hasField);

	if (hasField('timestamp')) {
		topic.timestampISO = utils.toISOString(topic.timestamp);
		if (hasField('scheduled')) {
			topic.scheduled = topic.timestamp > Date.now();
		}
	}

	if (hasField('lastposttime')) {
		topic.lastposttimeISO = utils.toISOString(topic.lastposttime);
	}

	if (hasField('pinExpiry')) {
		topic.pinExpiryISO = utils.toISOString(topic.pinExpiry);
	}

	if (hasField('upvotes') && hasField('downvotes')) {
		topic.votes = topic.upvotes - topic.downvotes;
	}

	if (hasField('teaserPid')) {
		topic.teaserPid = topic.teaserPid || null;
	}

	if (hasField('tags')) {
		const tags = String(topic.tags || '');
		topic.tags = tags.split(',').filter(Boolean).map((tag) => {
			const escaped = validator.escape(String(tag));
			return {
				value: tag,
				valueEscaped: escaped,
				valueEncoded: encodeURIComponent(tag),
				class: escaped.replace(/\s/g, '-'),
			};
		});
	}

	if (hasField('thumbs')) {
		try {
			topic.thumbs = topic.thumbs ? JSON.parse(String(topic.thumbs || '[]')) : [];
		} catch (e) {
			topic.thumbs = [];
		}
	}
}
