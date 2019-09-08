
'use strict';

const _ = require('lodash');

const db = require('../database');
const privileges = require('../privileges');
const user = require('../user');
const categories = require('../categories');
const meta = require('../meta');
const plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.getSortedTopics = async function (params) {
		var data = {
			nextStart: 0,
			topicCount: 0,
			topics: [],
		};

		params.term = params.term || 'alltime';
		params.sort = params.sort || 'recent';
		params.query = params.query || {};
		if (params.hasOwnProperty('cids') && params.cids && !Array.isArray(params.cids)) {
			params.cids = [params.cids];
		}
		data.tids = await getTids(params);
		data.topicCount = data.tids.length;
		data.topics = await getTopics(data.tids, params);
		data.nextStart = params.stop + 1;
		return data;
	};

	async function getTids(params) {
		let tids = [];
		if (params.term === 'alltime') {
			if (params.cids) {
				tids = await getCidTids(params.cids, params.sort);
			} else {
				tids = await db.getSortedSetRevRange('topics:' + params.sort, 0, 199);
			}
		} else {
			tids = await Topics.getLatestTidsFromSet('topics:tid', 0, -1, params.term);
		}
		if (params.term !== 'alltime' || params.cids || params.floatPinned) {
			tids = await sortTids(tids, params);
		}
		return await filterTids(tids, params);
	}

	async function getCidTids(cids, sort) {
		const sets = [];
		const pinnedSets = [];
		cids.forEach(function (cid) {
			if (sort === 'recent') {
				sets.push('cid:' + cid + ':tids');
			} else {
				sets.push('cid:' + cid + ':tids' + (sort ? ':' + sort : ''));
			}
			pinnedSets.push('cid:' + cid + ':tids:pinned');
		});
		const [tids, pinnedTids] = await Promise.all([
			db.getSortedSetRevRange(sets, 0, 199),
			db.getSortedSetRevRange(pinnedSets, 0, -1),
		]);
		return pinnedTids.concat(tids);
	}

	async function sortTids(tids, params) {
		const topicData = await Topics.getTopicsFields(tids, ['tid', 'lastposttime', 'upvotes', 'downvotes', 'postcount', 'pinned']);
		let sortFn = sortRecent;
		if (params.sort === 'posts') {
			sortFn = sortPopular;
		} else if (params.sort === 'votes') {
			sortFn = sortVotes;
		}

		if (params.floatPinned) {
			floatPinned(topicData, sortFn);
		} else {
			topicData.sort(sortFn);
		}

		return topicData.map(topic => topic && topic.tid);
	}

	function floatPinned(topicData, sortFn) {
		topicData.sort((a, b) => {
			if (a.pinned !== b.pinned) {
				return b.pinned - a.pinned;
			}
			return sortFn(a, b);
		});
	}

	function sortRecent(a, b) {
		return b.lastposttime - a.lastposttime;
	}

	function sortVotes(a, b) {
		if (a.votes !== b.votes) {
			return b.votes - a.votes;
		}
		return b.postcount - a.postcount;
	}

	function sortPopular(a, b) {
		if (a.postcount !== b.postcount) {
			return b.postcount - a.postcount;
		}
		return b.viewcount - a.viewcount;
	}

	async function filterTids(tids, params) {
		const filter = params.filter;
		const uid = params.uid;

		if (filter === 'watched') {
			tids = await Topics.filterWatchedTids(tids, uid);
		} else if (filter === 'new') {
			tids = await Topics.filterNewTids(tids, uid);
		} else if (filter === 'unreplied') {
			tids = await Topics.filterUnrepliedTids(tids);
		} else {
			tids = await Topics.filterNotIgnoredTids(tids, uid);
		}

		tids = await privileges.topics.filterTids('topics:read', tids, uid);
		let topicData = await Topics.getTopicsFields(tids, ['uid', 'tid', 'cid']);
		const topicCids = _.uniq(topicData.map(topic => topic.cid)).filter(Boolean);

		async function getIgnoredCids() {
			if (filter === 'watched' || meta.config.disableRecentCategoryFilter) {
				return [];
			}
			return await categories.isIgnored(topicCids, uid);
		}
		const [ignoredCids, filtered] = await Promise.all([
			getIgnoredCids(),
			user.blocks.filter(uid, topicData),
		]);

		const isCidIgnored = _.zipObject(topicCids, ignoredCids);
		topicData = filtered;

		const cids = params.cids && params.cids.map(String);
		tids = topicData.filter(function (topic) {
			return topic && topic.cid && !isCidIgnored[topic.cid] && (!cids || (cids.length && cids.includes(topic.cid.toString())));
		}).map(topic => topic.tid);

		const result = await plugins.fireHook('filter:topics.filterSortedTids', { tids: tids, params: params });
		return result.tids;
	}

	async function getTopics(tids, params) {
		tids = tids.slice(params.start, params.stop !== -1 ? params.stop + 1 : undefined);
		const topicData = await Topics.getTopicsByTids(tids, params);
		Topics.calculateTopicIndices(topicData, params.start);
		return topicData;
	}

	Topics.calculateTopicIndices = function (topicData, start) {
		topicData.forEach((topic, index) => {
			if (topic) {
				topic.index = start + index;
			}
		});
	};
};
