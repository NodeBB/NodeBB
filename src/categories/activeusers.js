// SPDX-FileCopyrightText: 2013-2021 NodeBB Inc
//
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

const _ = require('lodash');

const posts = require('../posts');
const db = require('../database');

module.exports = function (Categories) {
	Categories.getActiveUsers = async function (cids) {
		if (!Array.isArray(cids)) {
			cids = [cids];
		}
		const pids = await db.getSortedSetRevRange(cids.map(cid => `cid:${cid}:pids`), 0, 24);
		const postData = await posts.getPostsFields(pids, ['uid']);
		return _.uniq(postData.map(post => post.uid).filter(uid => uid));
	};
};
