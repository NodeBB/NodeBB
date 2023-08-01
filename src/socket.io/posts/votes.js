'use strict';

const _ = require('lodash');

const db = require('../../database');
const user = require('../../user');
const posts = require('../../posts');
const privileges = require('../../privileges');
const meta = require('../../meta');

module.exports = function (SocketPosts) {
	SocketPosts.getVoters = async function (socket, data) {
		if (!data || !data.pid || !data.cid) {
			throw new Error('[[error:invalid-data]]');
		}
		const showDownvotes = !meta.config['downvote:disabled'];
		const canSeeVotes = meta.config.votesArePublic || await privileges.categories.isAdminOrMod(data.cid, socket.uid);
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
		};
	};

	SocketPosts.getUpvoters = async function (socket, pids) {
		if (!Array.isArray(pids)) {
			throw new Error('[[error:invalid-data]]');
		}

		const [cids, data, isAdmin] = await Promise.all([
			posts.getCidsByPids(pids),
			posts.getUpvotedUidsByPids(pids),
			privileges.users.isAdministrator(socket.uid),
		]);

		if (!isAdmin) {
			const isAllowed = await privileges.categories.isUserAllowedTo(
				'topics:read', _.uniq(cids), socket.uid
			);
			if (isAllowed.includes(false)) {
				throw new Error('[[error:no-privileges]]');
			}
		}

		if (!data.length) {
			return [];
		}
		const cutoff = 6;
		const sliced = data.map((uids) => {
			let otherCount = 0;
			if (uids.length > cutoff) {
				otherCount = uids.length - (cutoff - 1);
				uids = uids.slice(0, cutoff - 1);
			}
			return {
				otherCount,
				uids,
			};
		});

		const uniqUids = _.uniq(_.flatten(sliced.map(d => d.uids)));
		const usernameMap = _.zipObject(uniqUids, await user.getUsernamesByUids(uniqUids));
		const result = sliced.map(
			data => ({
				otherCount: data.otherCount,
				cutoff: cutoff,
				usernames: data.uids.map(uid => usernameMap[uid]),
			})
		);
		return result;
	};
};
