'use strict';

var _ = require('lodash');
var validator = require('validator');

var db = require('../database');
var posts = require('../posts');
var topics = require('../topics');
var utils = require('../../public/src/utils');

module.exports = function (User) {
	User.getLatestBanInfo = async function (uid) {
		// Simply retrieves the last record of the user's ban, even if they've been unbanned since then.
		const record = await db.getSortedSetRevRange(`uid:${uid}:bans:timestamp`, 0, 0);
		if (!record.length) {
			throw new Error('no-ban-info');
		}
		const banInfo = await db.getObject(record[0]);
		const expire = parseInt(banInfo.expire, 10);
		const expire_readable = utils.toISOString(expire);
		return {
			uid: uid,
			timestamp: banInfo.timestamp,
			banned_until: expire,
			expiry: expire, /* backward compatible alias */
			banned_until_readable: expire_readable,
			expiry_readable: expire_readable, /* backward compatible alias */
			reason: validator.escape(String(banInfo.reason || '')),
		};
	};

	User.getModerationHistory = async function (uid) {
		let [flags, bans] = await Promise.all([
			db.getSortedSetRevRangeWithScores(`flags:byTargetUid:${uid}`, 0, 19),
			db.getSortedSetRevRange(`uid:${uid}:bans:timestamp`, 0, 19),
		]);

		// Get pids from flag objects
		const keys = flags.map(flagObj => `flag:${flagObj.value}`);
		const payload = await db.getObjectsFields(keys, ['type', 'targetId']);

		// Only pass on flag ids from posts
		flags = payload.reduce(function (memo, cur, idx) {
			if (cur.type === 'post') {
				memo.push({
					value: parseInt(cur.targetId, 10),
					score: flags[idx].score,
				});
			}

			return memo;
		}, []);

		[flags, bans] = await Promise.all([
			getFlagMetadata(flags),
			formatBanData(bans),
		]);

		return {
			flags: flags,
			bans: bans,
		};
	};

	User.getHistory = async function (set) {
		const data = await db.getSortedSetRevRangeWithScores(set, 0, -1);
		return data.map(function (set) {
			set.timestamp = set.score;
			set.timestampISO = utils.toISOString(set.score);
			set.value = validator.escape(String(set.value.split(':')[0]));
			delete set.score;
			return set;
		});
	};

	async function getFlagMetadata(flags) {
		const pids = flags.map(flagObj => parseInt(flagObj.value, 10));
		const postData = await posts.getPostsFields(pids, ['tid']);
		const tids = postData.map(post => post.tid);

		const topicData = await topics.getTopicsFields(tids, ['title']);
		flags = flags.map(function (flagObj, idx) {
			flagObj.pid = flagObj.value;
			flagObj.timestamp = flagObj.score;
			flagObj.timestampISO = new Date(flagObj.score).toISOString();
			flagObj.timestampReadable = new Date(flagObj.score).toString();

			delete flagObj.value;
			delete flagObj.score;
			if (!tids[idx]) {
				flagObj.targetPurged = true;
			}
			return _.extend(flagObj, topicData[idx]);
		});
		return flags;
	}

	async function formatBanData(bans) {
		const banData = await db.getObjects(bans);
		const uids = banData.map(banData => banData.fromUid);
		const usersData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
		return banData.map(function (banObj, index) {
			banObj.user = usersData[index];
			banObj.until = parseInt(banObj.expire, 10);
			banObj.untilReadable = new Date(banObj.until).toString();
			banObj.timestampReadable = new Date(parseInt(banObj.timestamp, 10)).toString();
			banObj.timestampISO = utils.toISOString(banObj.timestamp);
			banObj.reason = validator.escape(String(banObj.reason || '')) || '[[user:info.banned-no-reason]]';
			return banObj;
		});
	}

	User.getModerationNotes = async function (uid, start, stop) {
		const noteIds = await db.getSortedSetRevRange(`uid:${uid}:moderation:notes`, start, stop);
		const keys = noteIds.map(id => `uid:${uid}:moderation:note:${id}`);
		const notes = await db.getObjects(keys);
		const uids = [];

		const noteData = notes.map(function (note) {
			if (note) {
				uids.push(note.uid);
				note.timestampISO = utils.toISOString(note.timestamp);
				note.note = validator.escape(String(note.note));
			}
			return note;
		});

		const userData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
		noteData.forEach(function (note, index) {
			if (note) {
				note.user = userData[index];
			}
		});
		return noteData;
	};

	User.appendModerationNote = async ({ uid, noteData }) => {
		await db.sortedSetAdd(`uid:${uid}:moderation:notes`, noteData.timestamp, noteData.timestamp);
		await db.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, noteData);
	};
};
