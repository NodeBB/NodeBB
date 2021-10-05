'use strict';

const meta = require('../meta');
const db = require('../database');
const user = require('../user');
const topics = require('../topics');
const plugins = require('../plugins');
const privileges = require('../privileges');

module.exports = function (Posts) {
	const votesInProgress = {};

	Posts.upvote = async function (pid, uid) {
		if (meta.config['reputation:disabled']) {
			throw new Error('[[error:reputation-system-disabled]]');
		}
		const canUpvote = await privileges.posts.can('posts:upvote', pid, uid);
		if (!canUpvote) {
			throw new Error('[[error:no-privileges]]');
		}

		if (voteInProgress(pid, uid)) {
			throw new Error('[[error:already-voting-for-this-post]]');
		}
		putVoteInProgress(pid, uid);

		try {
			return await toggleVote('upvote', pid, uid);
		} finally {
			clearVoteProgress(pid, uid);
		}
	};

	Posts.downvote = async function (pid, uid) {
		if (meta.config['reputation:disabled']) {
			throw new Error('[[error:reputation-system-disabled]]');
		}

		if (meta.config['downvote:disabled']) {
			throw new Error('[[error:downvoting-disabled]]');
		}
		const canDownvote = await privileges.posts.can('posts:downvote', pid, uid);
		if (!canDownvote) {
			throw new Error('[[error:no-privileges]]');
		}

		if (voteInProgress(pid, uid)) {
			throw new Error('[[error:already-voting-for-this-post]]');
		}

		putVoteInProgress(pid, uid);
		try {
			return await toggleVote('downvote', pid, uid);
		} finally {
			clearVoteProgress(pid, uid);
		}
	};

	Posts.unvote = async function (pid, uid) {
		if (voteInProgress(pid, uid)) {
			throw new Error('[[error:already-voting-for-this-post]]');
		}

		putVoteInProgress(pid, uid);
		try {
			const voteStatus = await Posts.hasVoted(pid, uid);
			return await unvote(pid, uid, 'unvote', voteStatus);
		} finally {
			clearVoteProgress(pid, uid);
		}
	};

	Posts.hasVoted = async function (pid, uid) {
		if (parseInt(uid, 10) <= 0) {
			return { upvoted: false, downvoted: false };
		}
		const hasVoted = await db.isMemberOfSets([`pid:${pid}:upvote`, `pid:${pid}:downvote`], uid);
		return { upvoted: hasVoted[0], downvoted: hasVoted[1] };
	};

	Posts.getVoteStatusByPostIDs = async function (pids, uid) {
		if (parseInt(uid, 10) <= 0) {
			const data = pids.map(() => false);
			return { upvotes: data, downvotes: data };
		}
		const upvoteSets = pids.map(pid => `pid:${pid}:upvote`);
		const downvoteSets = pids.map(pid => `pid:${pid}:downvote`);
		const data = await db.isMemberOfSets(upvoteSets.concat(downvoteSets), uid);
		return {
			upvotes: data.slice(0, pids.length),
			downvotes: data.slice(pids.length, pids.length * 2),
		};
	};

	Posts.getUpvotedUidsByPids = async function (pids) {
		return await db.getSetsMembers(pids.map(pid => `pid:${pid}:upvote`));
	};

	function voteInProgress(pid, uid) {
		return Array.isArray(votesInProgress[uid]) && votesInProgress[uid].includes(parseInt(pid, 10));
	}

	function putVoteInProgress(pid, uid) {
		votesInProgress[uid] = votesInProgress[uid] || [];
		votesInProgress[uid].push(parseInt(pid, 10));
	}

	function clearVoteProgress(pid, uid) {
		if (Array.isArray(votesInProgress[uid])) {
			const index = votesInProgress[uid].indexOf(parseInt(pid, 10));
			if (index !== -1) {
				votesInProgress[uid].splice(index, 1);
			}
		}
	}

	async function toggleVote(type, pid, uid) {
		const voteStatus = await Posts.hasVoted(pid, uid);
		await unvote(pid, uid, type, voteStatus);
		return await vote(type, false, pid, uid, voteStatus);
	}

	async function unvote(pid, uid, type, voteStatus) {
		const owner = await Posts.getPostField(pid, 'uid');
		if (parseInt(uid, 10) === parseInt(owner, 10)) {
			throw new Error('[[error:self-vote]]');
		}

		if (type === 'downvote') {
			await checkDownvoteLimitation(pid, uid);
		}

		if (!voteStatus || (!voteStatus.upvoted && !voteStatus.downvoted)) {
			return;
		}

		return await vote(voteStatus.upvoted ? 'downvote' : 'upvote', true, pid, uid, voteStatus);
	}

	async function checkDownvoteLimitation(pid, uid) {
		const oneDay = 86400000;
		const [reputation, targetUid, downvotedPids] = await Promise.all([
			user.getUserField(uid, 'reputation'),
			Posts.getPostField(pid, 'uid'),
			db.getSortedSetRevRangeByScore(
				`uid:${uid}:downvote`, 0, -1, '+inf', Date.now() - oneDay
			),
		]);

		if (reputation < meta.config['min:rep:downvote']) {
			throw new Error('[[error:not-enough-reputation-to-downvote]]');
		}

		if (meta.config.downvotesPerDay && downvotedPids.length >= meta.config.downvotesPerDay) {
			throw new Error(`[[error:too-many-downvotes-today, ${meta.config.downvotesPerDay}]]`);
		}

		if (meta.config.downvotesPerUserPerDay) {
			const postData = await Posts.getPostsFields(downvotedPids, ['uid']);
			const targetDownvotes = postData.filter(p => p.uid === targetUid).length;
			if (targetDownvotes >= meta.config.downvotesPerUserPerDay) {
				throw new Error(`[[error:too-many-downvotes-today-user, ${meta.config.downvotesPerUserPerDay}]]`);
			}
		}
	}

	async function vote(type, unvote, pid, uid, voteStatus) {
		uid = parseInt(uid, 10);
		if (uid <= 0) {
			throw new Error('[[error:not-logged-in]]');
		}
		const now = Date.now();

		if (type === 'upvote' && !unvote) {
			await db.sortedSetAdd(`uid:${uid}:upvote`, now, pid);
		} else {
			await db.sortedSetRemove(`uid:${uid}:upvote`, pid);
		}

		if (type === 'upvote' || unvote) {
			await db.sortedSetRemove(`uid:${uid}:downvote`, pid);
		} else {
			await db.sortedSetAdd(`uid:${uid}:downvote`, now, pid);
		}

		const postData = await Posts.getPostFields(pid, ['pid', 'uid', 'tid']);
		const newReputation = await user.incrementUserReputationBy(postData.uid, type === 'upvote' ? 1 : -1);

		await adjustPostVotes(postData, uid, type, unvote);

		await fireVoteHook(postData, uid, type, unvote, voteStatus);

		return {
			user: {
				reputation: newReputation,
			},
			fromuid: uid,
			post: postData,
			upvote: type === 'upvote' && !unvote,
			downvote: type === 'downvote' && !unvote,
		};
	}

	async function fireVoteHook(postData, uid, type, unvote, voteStatus) {
		let hook = type;
		let current = voteStatus.upvoted ? 'upvote' : 'downvote';
		if (unvote) { // e.g. unvoting, removing a upvote or downvote
			hook = 'unvote';
		} else {	// e.g. User *has not* voted, clicks upvote or downvote
			current = 'unvote';
		}
		// action:post.upvote
		// action:post.downvote
		// action:post.unvote
		plugins.hooks.fire(`action:post.${hook}`, {
			pid: postData.pid,
			uid: uid,
			owner: postData.uid,
			current: current,
		});
	}

	async function adjustPostVotes(postData, uid, type, unvote) {
		const notType = (type === 'upvote' ? 'downvote' : 'upvote');
		if (unvote) {
			await db.setRemove(`pid:${postData.pid}:${type}`, uid);
		} else {
			await db.setAdd(`pid:${postData.pid}:${type}`, uid);
		}
		await db.setRemove(`pid:${postData.pid}:${notType}`, uid);

		const [upvotes, downvotes] = await Promise.all([
			db.setCount(`pid:${postData.pid}:upvote`),
			db.setCount(`pid:${postData.pid}:downvote`),
		]);
		postData.upvotes = upvotes;
		postData.downvotes = downvotes;
		postData.votes = postData.upvotes - postData.downvotes;
		await Posts.updatePostVoteCount(postData);
	}

	Posts.updatePostVoteCount = async function (postData) {
		if (!postData || !postData.pid || !postData.tid) {
			return;
		}
		await Promise.all([
			updateTopicVoteCount(postData),
			db.sortedSetAdd('posts:votes', postData.votes, postData.pid),
			Posts.setPostFields(postData.pid, {
				upvotes: postData.upvotes,
				downvotes: postData.downvotes,
			}),
		]);
		plugins.hooks.fire('action:post.updatePostVoteCount', { post: postData });
	};

	async function updateTopicVoteCount(postData) {
		const topicData = await topics.getTopicFields(postData.tid, ['mainPid', 'cid', 'pinned']);

		if (postData.uid) {
			if (postData.votes > 0) {
				await db.sortedSetAdd(`cid:${topicData.cid}:uid:${postData.uid}:pids:votes`, postData.votes, postData.pid);
			} else {
				await db.sortedSetRemove(`cid:${topicData.cid}:uid:${postData.uid}:pids:votes`, postData.pid);
			}
		}

		if (parseInt(topicData.mainPid, 10) !== parseInt(postData.pid, 10)) {
			return await db.sortedSetAdd(`tid:${postData.tid}:posts:votes`, postData.votes, postData.pid);
		}
		const promises = [
			topics.setTopicFields(postData.tid, {
				upvotes: postData.upvotes,
				downvotes: postData.downvotes,
			}),
			db.sortedSetAdd('topics:votes', postData.votes, postData.tid),
		];
		if (!topicData.pinned) {
			promises.push(db.sortedSetAdd(`cid:${topicData.cid}:tids:votes`, postData.votes, postData.tid));
		}
		await Promise.all(promises);
	}
};
