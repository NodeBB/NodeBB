'use strict';

import db from '../../database';
import user from '../../user';
const posts = require('../../posts');
const privileges = require('../../privileges');
import meta from '../../meta';

export default  function (SocketPosts) {
	SocketPosts.getVoters = async function (socket, data) {
		if (!data || !data.pid || !data.cid) {
			throw new Error('[[error:invalid-data]]');
		}
		const showDownvotes = !meta.config['downvote:disabled'];
		const canSeeVotes = meta.configs.votesArePublic || await privileges.categories.isAdminOrMod(data.cid, socket.uid);
		if (!canSeeVotes) {
			throw new Error('[[error:no-privileges]]');
		}
		const [upvoteUids, downvoteUids] = await Promise.all([
			db.getSetMembers(`pid:${data.pid}:upvote`),
			showDownvotes ? db.getSetMembers(`pid:${data.pid}:downvote`) : [],
		]);

		const [upvoters, downvoters] = await Promise.all([
			user.getUsersFields(upvoteUids, ['username', 'userslug', 'picture']),
			user.getUsersFields(downvoteUids, ['username', 'userslug', 'picture']),
		]);

		return {
			upvoteCount: upvoters.length,
			downvoteCount: downvoters.length,
			showDownvotes: showDownvotes,
			upvoters: upvoters,
			downvoters: downvoters,
		} as any;
	};

	SocketPosts.getUpvoters = async function (socket, pids) {
		if (!Array.isArray(pids)) {
			throw new Error('[[error:invalid-data]]');
		}
		const data = await posts.getUpvotedUidsByPids(pids);
		if (!data.length) {
			return [];
		}

		const result = await Promise.all(data.map(async (uids) => {
			let otherCount = 0;
			if (uids.length > 6) {
				otherCount = uids.length - 5;
				uids = uids.slice(0, 5);
			}
			const usernames = await user.getUsernamesByUids(uids);
			return {
				otherCount: otherCount,
				usernames: usernames,
			};
		}));
		return result;
	};
};
