'use strict';

const _ = require('lodash');

const db = require('../../database');
const user = require('../../user');
const posts = require('../../posts');
const privileges = require('../../privileges');
const meta = require('../../meta');

module.exports = function (SocketPosts) {
	SocketPosts.getVoters = async function (socket, data) {
		if (!data || !data.pid) {
			throw new Error('[[error:invalid-data]]');
		}
		const cid = await posts.getCidByPid(data.pid);
		if (!await canSeeVotes(socket.uid, cid)) {
			throw new Error('[[error:no-privileges]]');
		}
		const showDownvotes = !meta.config['downvote:disabled'];
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

		const cids = await posts.getCidsByPids(pids);
		if ((await canSeeVotes(socket.uid, cids)).includes(false)) {
			throw new Error('[[error:no-privileges]]');
		}

		const data = await posts.getUpvotedUidsByPids(pids);
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

	async function canSeeVotes(uid, cids) {
		const isArray = Array.isArray(cids);
		if (!isArray) {
			cids = [cids];
		}
		const uniqCids = _.uniq(cids);
		const [canRead, isAdmin, isMod] = await Promise.all([
			privileges.categories.isUserAllowedTo(
				'topics:read', uniqCids, uid
			),
			privileges.users.isAdministrator(uid),
			privileges.users.isModerator(uid, cids),
		]);
		const cidToAllowed = _.zipObject(uniqCids, canRead);
		const checks = cids.map(
			(cid, index) => isAdmin || isMod[index] || (cidToAllowed[cid] && !!meta.config.votesArePublic)
		);
		return isArray ? checks : checks[0];
	}
};
