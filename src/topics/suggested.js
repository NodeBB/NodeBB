
'use strict';

var _ = require('lodash');

const db = require('../database');
const user = require('../user');
var privileges = require('../privileges');
var search = require('../search');

module.exports = function (Topics) {
	Topics.getSuggestedTopics = async function (tid, uid, start, stop) {
		let tids;
		tid = parseInt(tid, 10);
		const [tagTids, searchTids] = await Promise.all([
			getTidsWithSameTags(tid),
			getSearchTids(tid, uid),
		]);

		tids = tagTids.concat(searchTids).filter(_tid => _tid !== tid);
		let categoryTids = [];
		if (stop !== -1 && tids.length < stop - start + 1) {
			categoryTids = await getCategoryTids(tid);
		}
		tids = _.shuffle(_.uniq(tids.concat(categoryTids)));
		tids = await privileges.topics.filterTids('topics:read', tids, uid);

		let topicData = await Topics.getTopicsByTids(tids, uid);
		topicData = topicData.filter(topic => topic && !topic.deleted && topic.tid !== tid);
		topicData = await user.blocks.filter(uid, topicData);
		topicData = topicData.slice(start, stop !== -1 ? stop + 1 : undefined);
		return topicData;
	};

	async function getTidsWithSameTags(tid) {
		const tags = await Topics.getTopicTags(tid);
		const tids = await db.getSortedSetRevRange(tags.map(tag => `tag:${tag}:topics`), 0, -1);
		return _.shuffle(_.uniq(tids)).slice(0, 10).map(Number);
	}

	async function getSearchTids(tid, uid) {
		const topicData = await Topics.getTopicFields(tid, ['title', 'cid']);
		const data = await search.search({
			query: topicData.title,
			searchIn: 'titles',
			matchWords: 'any',
			categories: [topicData.cid],
			uid: uid,
			returnIds: true,
		});
		return _.shuffle(data.tids).slice(0, 10).map(Number);
	}

	async function getCategoryTids(tid) {
		const cid = await Topics.getTopicField(tid, 'cid');
		const tids = await db.getSortedSetRevRange(`cid:${cid}:tids:lastposttime`, 0, 9);
		return _.shuffle(tids.map(Number).filter(_tid => _tid !== tid));
	}
};
