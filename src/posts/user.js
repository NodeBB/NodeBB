'use strict';

const async = require('async');
const validator = require('validator');
const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const topics = require('../topics');
const groups = require('../groups');
const meta = require('../meta');
const plugins = require('../plugins');
const privileges = require('../privileges');

module.exports = function (Posts) {
	Posts.getUserInfoForPosts = async function (uids, uid) {
		const [userData, userSettings, canUseSignature] = await Promise.all([
			getUserData(uids, uid),
			user.getMultipleUserSettings(uids),
			privileges.global.can('signature', uid),
		]);

		const groupsMap = await getGroupsMap(userData);

		userData.forEach((userData, index) => {
			userData.signature = validator.escape(String(userData.signature || ''));
			userData.fullname = userSettings[index].showfullname ? validator.escape(String(userData.fullname || '')) : undefined;
			userData.selectedGroups = [];

			if (meta.config.hideFullname) {
				userData.fullname = undefined;
			}
		});

		return await Promise.all(userData.map(async (userData) => {
			const [isMemberOfGroups, signature, customProfileInfo] = await Promise.all([
				checkGroupMembership(userData.uid, userData.groupTitleArray),
				parseSignature(userData, uid, canUseSignature),
				plugins.hooks.fire('filter:posts.custom_profile_info', { profile: [], uid: userData.uid }),
			]);

			if (isMemberOfGroups && userData.groupTitleArray) {
				userData.groupTitleArray.forEach((userGroup, index) => {
					if (isMemberOfGroups[index] && groupsMap[userGroup]) {
						userData.selectedGroups.push(groupsMap[userGroup]);
					}
				});
			}
			userData.signature = signature;
			userData.custom_profile_info = customProfileInfo.profile;

			return await plugins.hooks.fire('filter:posts.modifyUserInfo', userData);
		}));
	};

	async function checkGroupMembership(uid, groupTitleArray) {
		if (!Array.isArray(groupTitleArray) || !groupTitleArray.length) {
			return null;
		}
		return await groups.isMemberOfGroups(uid, groupTitleArray);
	}

	async function parseSignature(userData, uid, canUseSignature) {
		if (!userData.signature || !canUseSignature || meta.config.disableSignatures) {
			return '';
		}
		const result = await Posts.parseSignature(userData, uid);
		return result.userData.signature;
	}

	async function getGroupsMap(userData) {
		const groupTitles = _.uniq(_.flatten(userData.map(u => u && u.groupTitleArray)));
		const groupsMap = {};
		const groupsData = await groups.getGroupsData(groupTitles);
		groupsData.forEach((group) => {
			if (group && group.userTitleEnabled && !group.hidden) {
				groupsMap[group.name] = {
					name: group.name,
					slug: group.slug,
					labelColor: group.labelColor,
					textColor: group.textColor,
					icon: group.icon,
					userTitle: group.userTitle,
				};
			}
		});
		return groupsMap;
	}

	async function getUserData(uids, uid) {
		const fields = [
			'uid', 'username', 'fullname', 'userslug',
			'reputation', 'postcount', 'topiccount', 'picture',
			'signature', 'banned', 'banned:expire', 'status',
			'lastonline', 'groupTitle',
		];
		const result = await plugins.hooks.fire('filter:posts.addUserFields', {
			fields: fields,
			uid: uid,
			uids: uids,
		});
		return await user.getUsersFields(result.uids, _.uniq(result.fields));
	}

	Posts.isOwner = async function (pids, uid) {
		uid = parseInt(uid, 10);
		const isArray = Array.isArray(pids);
		pids = isArray ? pids : [pids];
		if (uid <= 0) {
			return isArray ? pids.map(() => false) : false;
		}
		const postData = await Posts.getPostsFields(pids, ['uid']);
		const result = postData.map(post => post && post.uid === uid);
		return isArray ? result : result[0];
	};

	Posts.isModerator = async function (pids, uid) {
		if (parseInt(uid, 10) <= 0) {
			return pids.map(() => false);
		}
		const cids = await Posts.getCidsByPids(pids);
		return await user.isModerator(uid, cids);
	};

	Posts.changeOwner = async function (pids, toUid) {
		const exists = await user.exists(toUid);
		if (!exists) {
			throw new Error('[[error:no-user]]');
		}
		let postData = await Posts.getPostsFields(pids, [
			'pid', 'tid', 'uid', 'content', 'deleted', 'timestamp', 'upvotes', 'downvotes',
		]);
		postData = postData.filter(p => p.pid && p.uid !== parseInt(toUid, 10));
		pids = postData.map(p => p.pid);

		const cids = await Posts.getCidsByPids(pids);

		const bulkRemove = [];
		const bulkAdd = [];
		let repChange = 0;
		const postsByUser = {};
		postData.forEach((post, i) => {
			post.cid = cids[i];
			repChange += post.votes;
			bulkRemove.push([`uid:${post.uid}:posts`, post.pid]);
			bulkRemove.push([`cid:${post.cid}:uid:${post.uid}:pids`, post.pid]);
			bulkRemove.push([`cid:${post.cid}:uid:${post.uid}:pids:votes`, post.pid]);

			bulkAdd.push([`uid:${toUid}:posts`, post.timestamp, post.pid]);
			bulkAdd.push([`cid:${post.cid}:uid:${toUid}:pids`, post.timestamp, post.pid]);
			if (post.votes > 0) {
				bulkAdd.push([`cid:${post.cid}:uid:${toUid}:pids:votes`, post.votes, post.pid]);
			}
			postsByUser[post.uid] = postsByUser[post.uid] || [];
			postsByUser[post.uid].push(post);
		});

		await Promise.all([
			db.setObjectField(pids.map(pid => `post:${pid}`), 'uid', toUid),
			db.sortedSetRemoveBulk(bulkRemove),
			db.sortedSetAddBulk(bulkAdd),
			user.incrementUserPostCountBy(toUid, pids.length),
			user.incrementUserReputationBy(toUid, repChange),
			handleMainPidOwnerChange(postData, toUid),
			reduceCounters(postsByUser),
			updateTopicPosters(postData, toUid),
		]);

		plugins.hooks.fire('action:post.changeOwner', {
			posts: _.cloneDeep(postData),
			toUid: toUid,
		});
		return postData;
	};

	async function reduceCounters(postsByUser) {
		await async.eachOfSeries(postsByUser, async (posts, uid) => {
			const repChange = posts.reduce((acc, val) => acc + val.votes, 0);
			await Promise.all([
				user.incrementUserPostCountBy(uid, -posts.length),
				user.incrementUserReputationBy(uid, -repChange),
			]);
		});
	}

	async function updateTopicPosters(postData, toUid) {
		const postsByTopic = _.groupBy(postData, p => parseInt(p.tid, 10));
		await async.eachOf(postsByTopic, async (posts, tid) => {
			const postsByUser = _.groupBy(posts, p => parseInt(p.uid, 10));
			await db.sortedSetIncrBy(`tid:${tid}:posters`, posts.length, toUid);
			await async.eachOf(postsByUser, async (posts, uid) => {
				await db.sortedSetIncrBy(`tid:${tid}:posters`, -posts.length, uid);
			});
		});
	}

	async function handleMainPidOwnerChange(postData, toUid) {
		const tids = _.uniq(postData.map(p => p.tid));
		const topicData = await topics.getTopicsFields(tids, [
			'tid', 'cid', 'deleted', 'title', 'uid', 'mainPid', 'timestamp',
		]);
		const tidToTopic = _.zipObject(tids, topicData);

		const mainPosts = postData.filter(p => p.pid === tidToTopic[p.tid].mainPid);
		if (!mainPosts.length) {
			return;
		}

		const bulkAdd = [];
		const bulkRemove = [];
		const postsByUser = {};
		mainPosts.forEach((post) => {
			bulkRemove.push([`cid:${post.cid}:uid:${post.uid}:tids`, post.tid]);
			bulkRemove.push([`uid:${post.uid}:topics`, post.tid]);

			bulkAdd.push([`cid:${post.cid}:uid:${toUid}:tids`, tidToTopic[post.tid].timestamp, post.tid]);
			bulkAdd.push([`uid:${toUid}:topics`, tidToTopic[post.tid].timestamp, post.tid]);
			postsByUser[post.uid] = postsByUser[post.uid] || [];
			postsByUser[post.uid].push(post);
		});

		await Promise.all([
			db.setObjectField(mainPosts.map(p => `topic:${p.tid}`), 'uid', toUid),
			db.sortedSetRemoveBulk(bulkRemove),
			db.sortedSetAddBulk(bulkAdd),
			user.incrementUserFieldBy(toUid, 'topiccount', mainPosts.length),
			reduceTopicCounts(postsByUser),
		]);

		const changedTopics = mainPosts.map(p => tidToTopic[p.tid]);
		plugins.hooks.fire('action:topic.changeOwner', {
			topics: _.cloneDeep(changedTopics),
			toUid: toUid,
		});
	}

	async function reduceTopicCounts(postsByUser) {
		await async.eachSeries(Object.keys(postsByUser), async (uid) => {
			const posts = postsByUser[uid];
			const exists = await user.exists(uid);
			if (exists) {
				await user.incrementUserFieldBy(uid, 'topiccount', -posts.length);
			}
		});
	}
};
