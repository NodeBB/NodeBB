'use strict';

const topics = require('../../topics');

const Tags = module.exports;

Tags.create = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	await topics.createEmptyTag(data.tag);
};

Tags.rename = async function (socket, data) {
	if (!Array.isArray(data)) {
		throw new Error('[[error:invalid-data]]');
	}

	await topics.renameTags(data);
};

Tags.deleteTags = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	await topics.deleteTags(data.tags);
};
