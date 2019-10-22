'use strict';

const topics = require('../../topics');
const categories = require('../../categories');
const privileges = require('../../privileges');
const utils = require('../../utils');

module.exports = function (SocketTopics) {
	SocketTopics.isTagAllowed = async function (socket, data) {
		if (!data || !utils.isNumber(data.cid) || !data.tag) {
			throw new Error('[[error:invalid-data]]');
		}

		const tagWhitelist = await categories.getTagWhitelist([data.cid]);
		return !tagWhitelist[0].length || tagWhitelist[0].includes(data.tag);
	};

	SocketTopics.autocompleteTags = async function (socket, data) {
		return await topics.autocompleteTags(data);
	};

	SocketTopics.searchTags = async function (socket, data) {
		return await searchTags(socket.uid, topics.searchTags, data);
	};

	SocketTopics.searchAndLoadTags = async function (socket, data) {
		return await searchTags(socket.uid, topics.searchAndLoadTags, data);
	};

	async function searchTags(uid, method, data) {
		const allowed = await privileges.global.can('search:tags', uid);
		if (!allowed) {
			throw new Error('[[error:no-privileges]]');
		}
		return await method(data);
	}

	SocketTopics.loadMoreTags = async function (socket, data) {
		if (!data || !utils.isNumber(data.after)) {
			throw new Error('[[error:invalid-data]]');
		}

		const start = parseInt(data.after, 10);
		const stop = start + 99;
		const tags = await topics.getTags(start, stop);

		return { tags: tags.filter(Boolean), nextStart: stop + 1 };
	};
};
