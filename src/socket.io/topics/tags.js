'use strict';

const meta = require('../../meta');
const user = require('../../user');
const topics = require('../../topics');
const categories = require('../../categories');
const privileges = require('../../privileges');
const utils = require('../../utils');

module.exports = function (SocketTopics) {
	SocketTopics.isTagAllowed = async function (socket, data) {
		if (!data || !utils.isNumber(data.cid) || !data.tag) {
			throw new Error('[[error:invalid-data]]');
		}

		const systemTags = (meta.config.systemTags || '').split(',');
		const [tagWhitelist, isPrivileged] = await Promise.all([
			categories.getTagWhitelist([data.cid]),
			user.isPrivileged(socket.uid),
		]);
		return isPrivileged ||
			(
				!systemTags.includes(data.tag) &&
				(!tagWhitelist[0].length || tagWhitelist[0].includes(data.tag))
			);
	};

	SocketTopics.canRemoveTag = async function (socket, data) {
		if (!data || !data.tag) {
			throw new Error('[[error:invalid-data]]');
		}

		const systemTags = (meta.config.systemTags || '').split(',');
		const isPrivileged = await user.isPrivileged(socket.uid);
		return isPrivileged || !systemTags.includes(String(data.tag).trim());
	};

	SocketTopics.autocompleteTags = async function (socket, data) {
		if (data.cid) {
			const canRead = await privileges.categories.can('topics:read', data.cid, socket.uid);
			if (!canRead) {
				throw new Error('[[error:no-privileges]]');
			}
		}
		data.cids = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
		const result = await topics.autocompleteTags(data);
		return result.map(tag => tag.value);
	};

	SocketTopics.searchTags = async function (socket, data) {
		const result = await searchTags(socket.uid, topics.searchTags, data);
		return result.map(tag => tag.value);
	};

	SocketTopics.searchAndLoadTags = async function (socket, data) {
		return await searchTags(socket.uid, topics.searchAndLoadTags, data);
	};

	async function searchTags(uid, method, data) {
		const allowed = await privileges.global.can('search:tags', uid);
		if (!allowed) {
			throw new Error('[[error:no-privileges]]');
		}
		if (data.cid) {
			const canRead = await privileges.categories.can('topics:read', data.cid, uid);
			if (!canRead) {
				throw new Error('[[error:no-privileges]]');
			}
		}
		data.cids = await categories.getCidsByPrivilege('categories:cid', uid, 'topics:read');
		return await method(data);
	}

	// used by tag filter search
	SocketTopics.tagFilterSearch = async function (socket, data) {
		let cids = [];
		if (Array.isArray(data.cids)) {
			cids = await privileges.categories.filterCids('topics:read', data.cids, socket.uid);
		} else { // if no cids passed in get all cids we can read
			cids = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
		}

		let tags = [];
		if (data.query) {
			const allowed = await privileges.global.can('search:tags', socket.uid);
			if (!allowed) {
				throw new Error('[[error:no-privileges]]');
			}
			tags = await topics.searchTags({
				query: data.query,
				cid: cids.length === 1 ? cids[0] : null,
				cids: cids,
			});
			topics.getTagData(tags);
		} else {
			tags = await topics.getCategoryTagsData(cids, 0, 39);
		}

		return tags.filter(t => t.score > 0);
	};

	SocketTopics.loadMoreTags = async function (socket, data) {
		if (!data || !utils.isNumber(data.after)) {
			throw new Error('[[error:invalid-data]]');
		}

		const start = parseInt(data.after, 10);
		const stop = start + 99;
		const cids = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
		const tags = await topics.getCategoryTagsData(cids, start, stop);
		return { tags: tags.filter(Boolean), nextStart: stop + 1 };
	};
};
