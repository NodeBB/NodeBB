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
		await batch.processSortedSet('cid:' + cid + ':tids', async function (tids) {
			await async.eachLimit(tids, 10, async function (tid) {
				await topics.purgePostsAndTopic(tid, uid);
			});
		}, { alwaysStartAt: 0 });

		const pinnedTids = await db.getSortedSetRevRange('cid:' + cid + ':tids:pinned', 0, -1);
		await async.eachLimit(pinnedTids, 10, async function (tid) {
			await topics.purgePostsAndTopic(tid, uid);
		});
		await purgeCategory(cid);
		plugins.fireHook('action:category.delete', { cid: cid, uid: uid });
	};

	async function purgeCategory(cid) {
		await db.sortedSetRemove('categories:cid', cid);
		await removeFromParent(cid);
		await db.deleteAll([
			'cid:' + cid + ':tids',
			'cid:' + cid + ':tids:pinned',
			'cid:' + cid + ':tids:posts',
			'cid:' + cid + ':pids',
			'cid:' + cid + ':read_by_uid',
			'cid:' + cid + ':uid:watch:state',
			'cid:' + cid + ':children',
			'cid:' + cid + ':tag:whitelist',
			'category:' + cid,
		]);
		await groups.destroy(privileges.privilegeList.map(privilege => 'cid:' + cid + ':privileges:' + privilege));
	}

	async function removeFromParent(cid) {
		const [parentCid, children] = await Promise.all([
			Categories.getCategoryField(cid, 'parentCid'),
			db.getSortedSetRange('cid:' + cid + ':children', 0, -1),
		]);

		const bulkAdd = [];
		const childrenKeys = children.map(function (cid) {
			bulkAdd.push(['cid:0:children', cid, cid]);
			return 'category:' + cid;
		});

		await Promise.all([
			db.sortedSetRemove('cid:' + parentCid + ':children', cid),
			db.setObjectField(childrenKeys, 'parentCid', 0),
			db.sortedSetAddBulk(bulkAdd),
		]);

		cache.del([
			'categories:cid',
			'cid:0:children',
			'cid:' + parentCid + ':children',
			'cid:' + cid + ':children',
			'cid:' + cid + ':tag:whitelist',
		]);
	}
};
