'use strict';

import * as database from '../database';
const db = database as any;


export default  function (Topics) {
	Topics.isOwner = async function (tid: string, uid: string | number) {
		uid = parseInt(uid as string, 10);
		if (uid <= 0) {
			return false;
		}
		const author = await Topics.getTopicField(tid, 'uid');
		return author === uid;
	};

	Topics.getUids = async function (tid: string) {
		return await db.getSortedSetRevRangeByScore(`tid:${tid}:posters`, 0, -1, '+inf', 1);
	};
};
