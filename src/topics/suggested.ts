
'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const privileges = require('../privileges');
const search = require('../search');

module.exports = function (Topics) {
	Topics.getSuggestedTopics = async function (tid, uid, start, stop, cutoff = 0) {
		let tids;
		tid = parseInt(tid, 10);
		cutoff = cutoff === 0 ? cutoff : (cutoff * 2592000000);
		const [tagTids, searchTids] = await Promise.all([
			getTidsWithSameTags(tid, cutoff),
			getSearchTids(tid, uid, cutoff),
		]);

		tids = _.uniq(tagTids.concat(searchTids));

		let categoryTids = [];
		if (stop !== -1 && tids.length < stop - start + 1) {
			categoryTids = await getCategoryTids(tid, cutoff);
		}
		tids = _.shuffle(_.uniq(tids.concat(categoryTids)));
		tids = await privileges.topics.filterTids('topics:read', tids, uid);

		let topicData = await Topics.getTopicsByTids(tids, uid);
		topicData = topicData.filter(topic => topic && topic.tid !== tid);
		topicData = await user.blocks.filter(uid, topicData);
		topicData = topicData.slice(start, stop !== -1 ? stop + 1 : undefined)
			.sort((t1, t2) => t2.timestamp - t1.timestamp);
		return topicData;
	};

	async function getTidsWithSameTags(tid, cutoff) {
		const tags = await Topics.getTopicTags(tid);
		let tids = cutoff === 0 ?
			await db.getSortedSetRevRange(tags.map(tag => `tag:${tag}:topics`), 0, -1) :
			await db.getSortedSetRevRangeByScore(tags.map(tag => `tag:${tag}:topics`), 0, -1, '+inf', Date.now() - cutoff);
		tids = tids.filter(_tid => _tid !== tid); // remove self
		return _.shuffle(_.uniq(tids)).slice(0, 10).map(Number);
	}

	async function getSearchTids(tid, uid, cutoff) {
		const topicData = await Topics.getTopicFields(tid, ['title', 'cid']);
		const data = await search.search({
			query: topicData.title,
			searchIn: 'titles',
			matchWords: 'any',
			categories: [topicData.cid],
			uid: uid,
			returnIds: true,
			timeRange: cutoff !== 0 ? cutoff / 1000 : 0,
			timeFilter: 'newer',
		});
		data.tids = data.tids.filter(_tid => _tid !== tid); // remove self
		return _.shuffle(data.tids).slice(0, 10).map(Number);
	}

	async function getCategoryTids(tid, cutoff) {
		const cid = await Topics.getTopicField(tid, 'cid');
		const tids = cutoff === 0 ?
			await db.getSortedSetRevRange(`cid:${cid}:tids:lastposttime`, 0, 9) :
			await db.getSortedSetRevRangeByScore(`cid:${cid}:tids:lastposttime`, 0, 9, '+inf', Date.now() - cutoff);
		return _.shuffle(tids.map(Number).filter(_tid => _tid !== tid));
	}
};
