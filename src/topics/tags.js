
'use strict';

const async = require('async');
const validator = require('validator');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const categories = require('../categories');
const plugins = require('../plugins');
const utils = require('../utils');
const batch = require('../batch');
const cache = require('../cache');

module.exports = function (Topics) {
	Topics.createTags = async function (tags, tid, timestamp) {
		if (!Array.isArray(tags) || !tags.length) {
			return;
		}
		const result = await plugins.hooks.fire('filter:tags.filter', { tags: tags, tid: tid });
		tags = _.uniq(result.tags)
			.map(tag => utils.cleanUpTag(tag, meta.config.maximumTagLength))
			.filter(tag => tag && tag.length >= (meta.config.minimumTagLength || 3));

		tags = await filterCategoryTags(tags, tid);
		await Promise.all([
			db.setAdd('topic:' + tid + ':tags', tags),
			db.sortedSetsAdd(tags.map(tag => 'tag:' + tag + ':topics'), timestamp, tid),
		]);

		await Promise.all(tags.map(tag => updateTagCount(tag)));
	};

	Topics.validateTags = async function (tags, cid) {
		if (!Array.isArray(tags)) {
			throw new Error('[[error:invalid-data]]');
		}
		tags = _.uniq(tags);
		const categoryData = await categories.getCategoryFields(cid, ['minTags', 'maxTags']);
		if (tags.length < parseInt(categoryData.minTags, 10)) {
			throw new Error('[[error:not-enough-tags, ' + categoryData.minTags + ']]');
		} else if (tags.length > parseInt(categoryData.maxTags, 10)) {
			throw new Error('[[error:too-many-tags, ' + categoryData.maxTags + ']]');
		}
	};

	async function filterCategoryTags(tags, tid) {
		const cid = await Topics.getTopicField(tid, 'cid');
		const tagWhitelist = await categories.getTagWhitelist([cid]);
		if (!Array.isArray(tagWhitelist[0]) || !tagWhitelist[0].length) {
			return tags;
		}
		const whitelistSet = new Set(tagWhitelist[0]);
		return tags.filter(tag => whitelistSet.has(tag));
	}

	Topics.createEmptyTag = async function (tag) {
		if (!tag) {
			throw new Error('[[error:invalid-tag]]');
		}
		if (tag.length < (meta.config.minimumTagLength || 3)) {
			throw new Error('[[error:tag-too-short]]');
		}
		const isMember = await db.isSortedSetMember('tags:topic:count', tag);
		if (!isMember) {
			await db.sortedSetAdd('tags:topic:count', 0, tag);
			cache.del('tags:topic:count');
		}
	};

	Topics.updateTags = async function (data) {
		await async.eachSeries(data, async function (tagData) {
			await db.setObject('tag:' + tagData.value, {
				color: tagData.color,
				bgColor: tagData.bgColor,
			});
		});
	};

	Topics.renameTags = async function (data) {
		await async.eachSeries(data, async function (tagData) {
			await renameTag(tagData.value, tagData.newName);
		});
	};

	async function renameTag(tag, newTagName) {
		if (!newTagName || tag === newTagName) {
			return;
		}
		newTagName = utils.cleanUpTag(newTagName, meta.config.maximumTagLength);
		await Topics.createEmptyTag(newTagName);
		const targetExists = await db.isSortedSetMember('tags:topic:count', newTagName);
		const tagData = await db.getObject('tag:' + tag);
		if (tagData && !targetExists) {
			await db.setObject('tag:' + newTagName, {
				color: tagData.color,
				bgColor: tagData.bgColor,
			});
		}

		await batch.processSortedSet('tag:' + tag + ':topics', async function (tids) {
			const scores = await db.sortedSetScores('tag:' + tag + ':topics', tids);
			await db.sortedSetAdd('tag:' + newTagName + ':topics', scores, tids);
			const keys = tids.map(tid => 'topic:' + tid + ':tags');
			await db.sortedSetRemove('tag:' + tag + ':topics', tids);
			await db.setsRemove(keys, tag);
			await db.setsAdd(keys, newTagName);
		}, {});
		await Topics.deleteTag(tag);
		await updateTagCount(newTagName);
	}

	async function updateTagCount(tag) {
		const count = await Topics.getTagTopicCount(tag);
		await db.sortedSetAdd('tags:topic:count', count || 0, tag);
		cache.del('tags:topic:count');
	}

	Topics.getTagTids = async function (tag, start, stop) {
		const tids = await db.getSortedSetRevRange('tag:' + tag + ':topics', start, stop);
		const payload = await plugins.hooks.fire('filter:topics.getTagTids', { tag, start, stop, tids });
		return payload.tids;
	};

	Topics.getTagTopicCount = async function (tag) {
		const count = await db.sortedSetCard('tag:' + tag + ':topics');
		const payload = await plugins.hooks.fire('filter:topics.getTagTopicCount', { tag, count });
		return payload.count;
	};

	Topics.deleteTags = async function (tags) {
		if (!Array.isArray(tags) || !tags.length) {
			return;
		}
		await removeTagsFromTopics(tags);
		const keys = tags.map(tag => 'tag:' + tag + ':topics');
		await db.deleteAll(keys);
		await db.sortedSetRemove('tags:topic:count', tags);
		cache.del('tags:topic:count');
		await db.deleteAll(tags.map(tag => 'tag:' + tag));
	};

	async function removeTagsFromTopics(tags) {
		await async.eachLimit(tags, 50, async function (tag) {
			const tids = await db.getSortedSetRange('tag:' + tag + ':topics', 0, -1);
			if (!tids.length) {
				return;
			}
			const keys = tids.map(tid => 'topic:' + tid + ':tags');
			await db.setsRemove(keys, tag);
		});
	}

	Topics.deleteTag = async function (tag) {
		await Topics.deleteTags([tag]);
	};

	Topics.getTags = async function (start, stop) {
		const tags = await db.getSortedSetRevRangeWithScores('tags:topic:count', start, stop);
		const payload = await plugins.hooks.fire('filter:tags.getAll', {
			tags: tags,
		});
		return await Topics.getTagData(payload.tags);
	};

	Topics.getTagData = async function (tags) {
		if (!tags.length) {
			return [];
		}
		const tagData = await db.getObjects(tags.map(tag => 'tag:' + tag.value));
		tags.forEach(function (tag, index) {
			tag.valueEscaped = validator.escape(String(tag.value));
			tag.color = tagData[index] ? tagData[index].color : '';
			tag.bgColor = tagData[index] ? tagData[index].bgColor : '';
		});
		return tags;
	};

	Topics.getTopicTags = async function (tid) {
		const tags = await db.getSetMembers('topic:' + tid + ':tags');
		return tags.sort();
	};

	Topics.getTopicsTags = async function (tids) {
		const keys = tids.map(tid => 'topic:' + tid + ':tags');
		const tags = await db.getSetsMembers(keys);
		tags.forEach(tags => tags.sort());
		return tags;
	};

	Topics.getTopicTagsObjects = async function (tid) {
		const data = await Topics.getTopicsTagsObjects([tid]);
		return Array.isArray(data) && data.length ? data[0] : [];
	};

	Topics.getTopicsTagsObjects = async function (tids) {
		const topicTags = await Topics.getTopicsTags(tids);
		const uniqueTopicTags = _.uniq(_.flatten(topicTags));

		const tags = uniqueTopicTags.map(tag => ({ value: tag }));

		const [tagData, counts] = await Promise.all([
			Topics.getTagData(tags),
			db.sortedSetScores('tags:topic:count', uniqueTopicTags),
		]);

		tagData.forEach(function (tag, index) {
			tag.score = counts[index] ? counts[index] : 0;
		});

		const tagDataMap = _.zipObject(uniqueTopicTags, tagData);

		topicTags.forEach(function (tags, index) {
			if (Array.isArray(tags)) {
				topicTags[index] = tags.map(tag => tagDataMap[tag]);
				topicTags[index].sort((tag1, tag2) => tag2.score - tag1.score);
			}
		});

		return topicTags;
	};

	Topics.addTags = async function (tags, tids) {
		const topicData = await Topics.getTopicsFields(tids, ['timestamp']);
		const sets = tids.map(tid => 'topic:' + tid + ':tags');
		for (let i = 0; i < tags.length; i++) {
			/* eslint-disable no-await-in-loop */
			await Promise.all([
				db.setsAdd(sets, tags[i]),
				db.sortedSetAdd('tag:' + tags[i] + ':topics', topicData.map(t => t.timestamp), tids),
			]);
			await updateTagCount(tags[i]);
		}
	};

	Topics.removeTags = async function (tags, tids) {
		const sets = tids.map(tid => 'topic:' + tid + ':tags');
		for (let i = 0; i < tags.length; i++) {
			/* eslint-disable no-await-in-loop */
			await Promise.all([
				db.setsRemove(sets, tags[i]),
				db.sortedSetRemove('tag:' + tags[i] + ':topics', tids),
			]);
			await updateTagCount(tags[i]);
		}
	};

	Topics.updateTopicTags = async function (tid, tags) {
		await Topics.deleteTopicTags(tid);
		const timestamp = await Topics.getTopicField(tid, 'timestamp');
		await Topics.createTags(tags, tid, timestamp);
	};

	Topics.deleteTopicTags = async function (tid) {
		const tags = await Topics.getTopicTags(tid);
		await db.delete('topic:' + tid + ':tags');
		const sets = tags.map(tag => 'tag:' + tag + ':topics');
		await db.sortedSetsRemove(sets, tid);
		await Promise.all(tags.map(tag => updateTagCount(tag)));
	};

	Topics.searchTags = async function (data) {
		if (!data || !data.query) {
			return [];
		}
		let result;
		if (plugins.hooks.hasListeners('filter:topics.searchTags')) {
			result = await plugins.hooks.fire('filter:topics.searchTags', { data: data });
		} else {
			result = await findMatches(data.query, 0);
		}
		result = await plugins.hooks.fire('filter:tags.search', { data: data, matches: result.matches });
		return result.matches;
	};

	Topics.autocompleteTags = async function (data) {
		if (!data || !data.query) {
			return [];
		}
		let result;
		if (plugins.hooks.hasListeners('filter:topics.autocompleteTags')) {
			result = await plugins.hooks.fire('filter:topics.autocompleteTags', { data: data });
		} else {
			result = await findMatches(data.query, data.cid);
		}
		return result.matches;
	};

	async function getAllTags() {
		const cached = cache.get('tags:topic:count');
		if (cached !== undefined) {
			return cached;
		}
		const tags = await db.getSortedSetRevRange('tags:topic:count', 0, -1);
		cache.set('tags:topic:count', tags);
		return tags;
	}

	async function findMatches(query, cid) {
		let tagWhitelist = [];
		if (parseInt(cid, 10)) {
			tagWhitelist = await categories.getTagWhitelist([cid]);
		}
		let tags = [];
		if (Array.isArray(tagWhitelist[0]) && tagWhitelist[0].length) {
			tags = tagWhitelist[0];
		} else {
			tags = await getAllTags();
		}

		query = query.toLowerCase();

		const matches = [];
		for (let i = 0; i < tags.length; i += 1) {
			if (tags[i].toLowerCase().startsWith(query)) {
				matches.push(tags[i]);
				if (matches.length > 19) {
					break;
				}
			}
		}

		matches.sort();
		return { matches: matches };
	}

	Topics.searchAndLoadTags = async function (data) {
		const searchResult = {
			tags: [],
			matchCount: 0,
			pageCount: 1,
		};

		if (!data || !data.query || !data.query.length) {
			return searchResult;
		}
		const tags = await Topics.searchTags(data);
		const [counts, tagData] = await Promise.all([
			db.sortedSetScores('tags:topic:count', tags),
			Topics.getTagData(tags.map(tag => ({ value: tag }))),
		]);
		tagData.forEach(function (tag, index) {
			tag.score = counts[index];
		});
		tagData.sort((a, b) => b.score - a.score);
		searchResult.tags = tagData;
		searchResult.matchCount = tagData.length;
		searchResult.pageCount = 1;
		return searchResult;
	};

	Topics.getRelatedTopics = async function (topicData, uid) {
		if (plugins.hooks.hasListeners('filter:topic.getRelatedTopics')) {
			const result = await plugins.hooks.fire('filter:topic.getRelatedTopics', { topic: topicData, uid: uid, topics: [] });
			return result.topics;
		}

		let maximumTopics = meta.config.maximumRelatedTopics;
		if (maximumTopics === 0 || !topicData.tags || !topicData.tags.length) {
			return [];
		}

		maximumTopics = maximumTopics || 5;
		let tids = await Promise.all(topicData.tags.map(tag => Topics.getTagTids(tag.value, 0, 5)));
		tids = _.shuffle(_.uniq(_.flatten(tids))).slice(0, maximumTopics);
		const topics = await Topics.getTopics(tids, uid);
		return topics.filter(t => t && !t.deleted && parseInt(t.uid, 10) !== parseInt(uid, 10));
	};
};
