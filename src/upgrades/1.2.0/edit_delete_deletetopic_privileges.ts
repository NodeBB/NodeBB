/* eslint-disable no-await-in-loop */

'use strict';

const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Granting edit/delete/delete topic on existing categories',
	timestamp: Date.UTC(2016, 7, 7),
	method: async function () {
		const groupsAPI = require('../../groups');
		const privilegesAPI = require('../../privileges');

		const cids = await db.getSortedSetRange('categories:cid', 0, -1);

		for (const cid of cids) {
			const data = await privilegesAPI.categories.list(cid);
			const { groups, users } = data;

			for (const group of groups) {
				if (group.privileges['groups:topics:reply']) {
					await Promise.all([
						groupsAPI.join(`cid:${cid}:privileges:groups:posts:edit`, group.name),
						groupsAPI.join(`cid:${cid}:privileges:groups:posts:delete`, group.name),
					]);
					winston.verbose(`cid:${cid}:privileges:groups:posts:edit, cid:${cid}:privileges:groups:posts:delete granted to gid: ${group.name}`);
				}

				if (group.privileges['groups:topics:create']) {
					await groupsAPI.join(`cid:${cid}:privileges:groups:topics:delete`, group.name);
					winston.verbose(`cid:${cid}:privileges:groups:topics:delete granted to gid: ${group.name}`);
				}
			}

			for (const user of users) {
				if (user.privileges['topics:reply']) {
					await Promise.all([
						groupsAPI.join(`cid:${cid}:privileges:posts:edit`, user.uid),
						groupsAPI.join(`cid:${cid}:privileges:posts:delete`, user.uid),
					]);
					winston.verbose(`cid:${cid}:privileges:posts:edit, cid:${cid}:privileges:posts:delete granted to uid: ${user.uid}`);
				}
				if (user.privileges['topics:create']) {
					await groupsAPI.join(`cid:${cid}:privileges:topics:delete`, user.uid);
					winston.verbose(`cid:${cid}:privileges:topics:delete granted to uid: ${user.uid}`);
				}
			}
			winston.verbose(`-- cid ${cid} upgraded`);
		}
	},
};
