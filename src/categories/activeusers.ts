'use strict';

import _ from 'lodash';
import posts from '../posts';
import db from '../database';

export default function (Categories) {
	Categories.getActiveUsers = async function (cids) {
		if (!Array.isArray(cids)) {
			cids = [cids];
		}
		const pids = await db.getSortedSetRevRange(cids.map(cid => `cid:${cid}:pids`), 0, 24);
		const postData = await posts.getPostsFields(pids, ['uid']);
		return _.uniq(postData.map(post => post.uid).filter(uid => uid));
	};
};
