
'use strict';

const winston = require('winston');
const _ = require('lodash');

const db = require('../database');
const posts = require('../posts');
const topics = require('../topics');
const privileges = require('../privileges');
const plugins = require('../plugins');
const batch = require('../batch');

module.exports = function (Categories) {
	Categories.getRecentReplies = async function (cid, uid, start, stop) {
		// backwards compatibility, treat start as count
		if (stop === undefined && start > 0) {
			winston.warn('[Categories.getRecentReplies] 3 params deprecated please use Categories.getRecentReplies(cid, uid, start, stop)');
			stop = start - 1;
			start = 0;
		}
		let pids = await db.getSortedSetRevRange(`cid:${cid}:pids`, start, stop);
		pids = await privileges.posts.filter('topics:read', pids, uid);
		return await posts.getPostSummaryByPids(pids, uid, { stripTags: true });
	};

	Categories.updateRecentTid = async function (cid, tid) {
		const [count, numRecentReplies] = await Promise.all([
			db.sortedSetCard(`cid:${cid}:recent_tids`),
			db.getObjectField(`category:${cid}`, 'numRecentReplies'),
		]);

		if (count >= numRecentReplies) {
			const data = await db.getSortedSetRangeWithScores(`cid:${cid}:recent_tids`, 0, count - numRecentReplies);
			const shouldRemove = !(data.length === 1 && count === 1 && data[0].value === String(tid));
			if (data.length && shouldRemove) {
				await db.sortedSetsRemoveRangeByScore([`cid:${cid}:recent_tids`], '-inf', data[data.length - 1].score);
			}
		}
		if (numRecentReplies > 0) {
			await db.sortedSetAdd(`cid:${cid}:recent_tids`, Date.now(), tid);
		}
		await plugins.hooks.fire('action:categories.updateRecentTid', { cid: cid, tid: tid });
	};

	Categories.updateRecentTidForCid = async function (cid) {
		let postData;
		let topicData;
		let index = 0;
		do {
			/* eslint-disable no-await-in-loop */
			const pids = await db.getSortedSetRevRange(`cid:${cid}:pids`, index, index);
			if (!pids.length) {
				return;
			}
			postData = await posts.getPostFields(pids[0], ['tid', 'deleted']);

			if (postData && postData.tid && !postData.deleted) {
				topicData = await topics.getTopicData(postData.tid);
			}
			index += 1;
		} while (!topicData || topicData.deleted || topicData.scheduled);

		if (postData && postData.tid) {
			await Categories.updateRecentTid(cid, postData.tid);
		}
	};

	Categories.getRecentTopicReplies = async function (categoryData, uid, query) {
		if (!Array.isArray(categoryData) || !categoryData.length) {
			return;
		}
		const categoriesToLoad = categoryData.filter(c => c && c.numRecentReplies && parseInt(c.numRecentReplies, 10) > 0);
		let keys = [];
		if (plugins.hooks.hasListeners('filter:categories.getRecentTopicReplies')) {
			const result = await plugins.hooks.fire('filter:categories.getRecentTopicReplies', {
				categories: categoriesToLoad,
				uid: uid,
				query: query,
				keys: [],
			});
			keys = result.keys;
		} else {
			keys = categoriesToLoad.map(c => `cid:${c.cid}:recent_tids`);
		}

		const results = await db.getSortedSetsMembers(keys);
		let tids = _.uniq(_.flatten(results).filter(Boolean));

		tids = await privileges.topics.filterTids('topics:read', tids, uid);
		const topics = await getTopics(tids, uid);
		assignTopicsToCategories(categoryData, topics);

		bubbleUpChildrenPosts(categoryData);
	};

	async function getTopics(tids, uid) {
		const topicData = await topics.getTopicsFields(
			tids,
			['tid', 'mainPid', 'slug', 'title', 'teaserPid', 'cid', 'postcount']
		);
		topicData.forEach((topic) => {
			if (topic) {
				topic.teaserPid = topic.teaserPid || topic.mainPid;
			}
		});
		const cids = _.uniq(topicData.map(t => t && t.cid).filter(cid => parseInt(cid, 10)));
		const getToRoot = async () => await Promise.all(cids.map(Categories.getParentCids));
		const [toRoot, teasers] = await Promise.all([
			getToRoot(),
			topics.getTeasers(topicData, uid),
		]);
		const cidToRoot = _.zipObject(cids, toRoot);

		teasers.forEach((teaser, index) => {
			if (teaser) {
				teaser.cid = topicData[index].cid;
				teaser.parentCids = cidToRoot[teaser.cid];
				teaser.tid = topicData[index].tid;
				teaser.uid = topicData[index].uid;
				teaser.topic = {
					tid: topicData[index].tid,
					slug: topicData[index].slug,
					title: topicData[index].title,
				};
			}
		});
		return teasers.filter(Boolean);
	}

	function assignTopicsToCategories(categories, topics) {
		categories.forEach((category) => {
			if (category) {
				category.posts = topics.filter(t => t.cid && (t.cid === category.cid || t.parentCids.includes(category.cid)))
					.sort((a, b) => b.timestamp - a.timestamp)
					.slice(0, parseInt(category.numRecentReplies, 10));
			}
		});
		topics.forEach((t) => { t.parentCids = undefined; });
	}

	function bubbleUpChildrenPosts(categoryData) {
		categoryData.forEach((category) => {
			if (category) {
				if (category.posts.length) {
					return;
				}
				const posts = [];
				getPostsRecursive(category, posts);

				posts.sort((a, b) => b.timestamp - a.timestamp);
				if (posts.length) {
					category.posts = [posts[0]];
				}
			}
		});
	}

	function getPostsRecursive(category, posts) {
		if (Array.isArray(category.posts)) {
			category.posts.forEach(p => posts.push(p));
		}

		category.children.forEach(child => getPostsRecursive(child, posts));
	}

	// terrible name, should be topics.moveTopicPosts
	Categories.moveRecentReplies = async function (tid, oldCid, cid) {
		const [pids, topicDeleted] = await Promise.all([
			topics.getPids(tid),
			topics.getTopicField(tid, 'deleted'),
		]);

		await batch.processArray(pids, async (pids) => {
			const postData = await posts.getPostsFields(pids, ['pid', 'deleted', 'uid', 'timestamp', 'upvotes', 'downvotes']);

			const bulkRemove = [];
			const bulkAdd = [];
			postData.forEach((post) => {
				bulkRemove.push([`cid:${oldCid}:uid:${post.uid}:pids`, post.pid]);
				bulkRemove.push([`cid:${oldCid}:uid:${post.uid}:pids:votes`, post.pid]);
				bulkAdd.push([`cid:${cid}:uid:${post.uid}:pids`, post.timestamp, post.pid]);
				if (post.votes > 0 || post.votes < 0) {
					bulkAdd.push([`cid:${cid}:uid:${post.uid}:pids:votes`, post.votes, post.pid]);
				}
			});

			const postsToReAdd = postData.filter(p => !p.deleted && !topicDeleted);
			const timestamps = postsToReAdd.map(p => p && p.timestamp);
			await Promise.all([
				db.sortedSetRemove(`cid:${oldCid}:pids`, pids),
				db.sortedSetAdd(`cid:${cid}:pids`, timestamps, postsToReAdd.map(p => p.pid)),
				db.sortedSetRemoveBulk(bulkRemove),
				db.sortedSetAddBulk(bulkAdd),
			]);
		}, { batch: 500 });
	};
};
