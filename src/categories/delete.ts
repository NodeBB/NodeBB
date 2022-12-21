'use strict';

const async = require('async');
const db = require('../database');
const batch = require('../batch');
const plugins = require('../plugins');
const topics = require('../topics');
const groups = require('../groups');
const privileges = require('../privileges');
const cache = require('../cache');

module.exports = function (Categories) {
	Categories.purge = async function (cid, uid) {
		await batch.processSortedSet(`cid:${cid}:tids`, async (tids) => {
			await async.eachLimit(tids, 10, async (tid) => {
				await topics.purgePostsAndTopic(tid, uid);
			});
		}, { alwaysStartAt: 0 });

		const pinnedTids = await db.getSortedSetRevRange(`cid:${cid}:tids:pinned`, 0, -1);
		await async.eachLimit(pinnedTids, 10, async (tid) => {
			await topics.purgePostsAndTopic(tid, uid);
		});
		const categoryData = await Categories.getCategoryData(cid);
		await purgeCategory(cid, categoryData);
		plugins.hooks.fire('action:category.delete', { cid: cid, uid: uid, category: categoryData });
	};

	async function purgeCategory(cid, categoryData) {
		const bulkRemove = [['categories:cid', cid]];
		if (categoryData && categoryData.name) {
			bulkRemove.push(['categories:name', `${categoryData.name.slice(0, 200).toLowerCase()}:${cid}`]);
		}
		await db.sortedSetRemoveBulk(bulkRemove);

		await removeFromParent(cid);
		await deleteTags(cid);
		await db.deleteAll([
			`cid:${cid}:tids`,
			`cid:${cid}:tids:pinned`,
			`cid:${cid}:tids:posts`,
			`cid:${cid}:tids:votes`,
			`cid:${cid}:tids:views`,
			`cid:${cid}:tids:lastposttime`,
			`cid:${cid}:recent_tids`,
			`cid:${cid}:pids`,
			`cid:${cid}:read_by_uid`,
			`cid:${cid}:uid:watch:state`,
			`cid:${cid}:children`,
			`cid:${cid}:tag:whitelist`,
			`category:${cid}`,
		]);
		const privilegeList = await privileges.categories.getPrivilegeList();
		await groups.destroy(privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`));
	}

	async function removeFromParent(cid) {
		const [parentCid, children] = await Promise.all([
			Categories.getCategoryField(cid, 'parentCid'),
			db.getSortedSetRange(`cid:${cid}:children`, 0, -1),
		]);

		const bulkAdd = [];
		const childrenKeys = children.map((cid) => {
			bulkAdd.push(['cid:0:children', cid, cid]);
			return `category:${cid}`;
		});

		await Promise.all([
			db.sortedSetRemove(`cid:${parentCid}:children`, cid),
			db.setObjectField(childrenKeys, 'parentCid', 0),
			db.sortedSetAddBulk(bulkAdd),
		]);

		cache.del([
			'categories:cid',
			'cid:0:children',
			`cid:${parentCid}:children`,
			`cid:${parentCid}:children:all`,
			`cid:${cid}:children`,
			`cid:${cid}:children:all`,
			`cid:${cid}:tag:whitelist`,
		]);
	}

	async function deleteTags(cid) {
		const tags = await db.getSortedSetMembers(`cid:${cid}:tags`);
		await db.deleteAll(tags.map(tag => `cid:${cid}:tag:${tag}:topics`));
		await db.delete(`cid:${cid}:tags`);
	}
};
