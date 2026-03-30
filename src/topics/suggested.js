
'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const privileges = require('../privileges');
const plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.getSuggestedTopics = async function (tid, uid, start, stop, cutoff = 0) {
		let tids;
		if (!tid) {
			return [];
		}
		tid = String(tid);
		cutoff = cutoff === 0 ? cutoff : (cutoff * 2592000000);
		const { cid, title, tags } = await Topics.getTopicFields(tid, [
			'cid', 'title', 'tags',
		]);

		const [tagTids, searchTids] = await Promise.all([
			getTidsWithSameTags(tid, tags.map(t => t.value), cutoff),
			getSearchTids(tid, title, cid, cutoff),
		]);

		tids = _.uniq(tagTids.concat(searchTids));

		let categoryTids = [];
		if (stop !== -1 && tids.length < stop - start + 1) {
			categoryTids = await getCategoryTids(tid, cid, cutoff);
		}
		tids = _.shuffle(_.uniq(tids.concat(categoryTids)));
		tids = await privileges.topics.filterTids('topics:read', tids, uid);

		let topicData = await Topics.getTopicsByTids(tids, uid);
		topicData = topicData.filter(topic => topic && String(topic.tid) !== tid);
		topicData = await user.blocks.filter(uid, topicData);
		topicData = topicData.slice(start, stop !== -1 ? stop + 1 : undefined)
			.sort((t1, t2) => t2.timestamp - t1.timestamp);
		Topics.calculateTopicIndices(topicData, start);
		return topicData;
	};

	async function getTidsWithSameTags(tid, tags, cutoff) {
		let tids = cutoff === 0 ?
			await db.getSortedSetRevRange(tags.map(tag => `tag:${tag}:topics`), 0, -1) :
			await db.getSortedSetRevRangeByScore(tags.map(tag => `tag:${tag}:topics`), 0, -1, '+inf', Date.now() - cutoff);
		tids = tids.filter(_tid => _tid !== tid); // remove self
		return _.shuffle(_.uniq(tids)).slice(0, 10);
	}

	async function getSearchTids(tid, title, cid, cutoff) {
		let { ids: tids } = await plugins.hooks.fire('filter:search.query', {
			index: 'topic',
			content: title,
			matchWords: 'any',
			cid: [cid],
			limit: 20,
			ids: [],
		});
		tids = tids.filter(_tid => String(_tid) !== tid); // remove self
		if (cutoff) {
			const topicData = await Topics.getTopicsFields(tids, ['tid', 'timestamp']);
			const now = Date.now();
			tids = topicData.filter(t => t && t.timestamp > now - cutoff).map(t => t.tid);
		}

		return _.shuffle(tids).slice(0, 10).map(String);
	}

	async function getCategoryTids(tid, cid, cutoff) {
		const tids = cutoff === 0 ?
			await db.getSortedSetRevRange(`cid:${cid}:tids:lastposttime`, 0, 9) :
			await db.getSortedSetRevRangeByScore(`cid:${cid}:tids:lastposttime`, 0, 10, '+inf', Date.now() - cutoff);
		return _.shuffle(tids.filter(_tid => _tid !== tid));
	}
};
