/* eslint-disable no-await-in-loop */

'use strict';

import winston from 'winston';
import db from '../../database';
import groupsAPI from '../../groups';
import privilegesAPI from '../../privileges';

export const obj = {
	name: 'Giving topics:read privs to any group/user that was previously allowed to Find & Access Category',
	timestamp: Date.UTC(2016, 4, 28),
	method: async function () {

		const cids = await db.getSortedSetRange('categories:cid', 0, -1);
		for (const cid of cids) {
			const { groups, users } = await privilegesAPI.categories.list(cid);

			for (const group of groups) {
				if (group.privileges['groups:read']) {
					await groupsAPI.join(`cid:${cid}:privileges:groups:topics:read`, group.name);
					winston.verbose(`cid:${cid}:privileges:groups:topics:read granted to gid: ${group.name}`);
				}
			}

			for (const user of users) {
				if (user.privileges.read) {
					await groupsAPI.join(`cid:${cid}:privileges:topics:read`, user.uid);
					winston.verbose(`cid:${cid}:privileges:topics:read granted to uid: ${user.uid}`);
				}
			}
			winston.verbose(`-- cid ${cid} upgraded`);
		}
	},
};
