'use strict';

var async = require('async');
var db = require('../database');
var batch = require('../batch');
var plugins = require('../plugins');
var topics = require('../topics');
var groups = require('../groups');
var privileges = require('../privileges');
var cache = require('../cache');

module.exports = function (Categories) {
	Categories.purge = async function (cid, uid) {
		await batch.processSortedSet(`cid:${cid}:tids`, async function (tids) {
			await async.eachLimit(tids, 10, async function (tid) {
				await topics.purgePostsAndTopic(tid, uid);
			});
		}, { alwaysStartAt: 0 });

		const pinnedTids = await db.getSortedSetRevRange(`cid:${cid}:tids:pinned`, 0, -1);
		await async.eachLimit(pinnedTids, 10, async function (tid) {
			await topics.purgePostsAndTopic(tid, uid);
		});
		const categoryData = await Categories.getCategoryData(cid);
		await purgeCategory(categoryData);
		plugins.hooks.fire('action:category.delete', { cid: cid, uid: uid, category: categoryData });
	};

	async function purgeCategory(categoryData) {
		const cid = categoryData.cid;
		await db.sortedSetRemoveBulk([
			['categories:cid', cid],
			['categories:name', `${categoryData.name.substr(0, 200).toLowerCase()}:${cid}`],
		]);
		await removeFromParent(cid);
		await deleteTags(cid);
		await db.deleteAll([
			`cid:${cid}:tids`,
			`cid:${cid}:tids:pinned`,
			`cid:${cid}:tids:posts`,
			`cid:${cid}:tids:votes`,
			`cid:${cid}:tids:lastposttime`,
			`cid:${cid}:recent_tids`,
			`cid:${cid}:pids`,
			`cid:${cid}:read_by_uid`,
			`cid:${cid}:uid:watch:state`,
			`cid:${cid}:children`,
			`cid:${cid}:tag:whitelist`,
			`category:${cid}`,
		]);
		await groups.destroy(privileges.privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`));
	}

	async function removeFromParent(cid) {
		const [parentCid, children] = await Promise.all([
			Categories.getCategoryField(cid, 'parentCid'),
			db.getSortedSetRange(`cid:${cid}:children`, 0, -1),
		]);

		const bulkAdd = [];
		const childrenKeys = children.map(function (cid) {
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
