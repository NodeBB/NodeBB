'use strict';

const _ = require('lodash');
const validator = require('validator');

const db = require('../database');
const posts = require('../posts');
const topics = require('../topics');
const utils = require('../utils');
const plugins = require('../plugins');
const Flags = require('../flags');

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
		let [flags, bans, mutes] = await Promise.all([
			db.getSortedSetRevRangeWithScores(`flags:byTargetUid:${uid}`, 0, 19),
			db.getSortedSetRevRange([
				`uid:${uid}:bans:timestamp`, `uid:${uid}:unbans:timestamp`,
			], 0, 19),
			db.getSortedSetRevRange([
				`uid:${uid}:mutes:timestamp`, `uid:${uid}:unmutes:timestamp`,
			], 0, 19),
		]);

		const keys = flags.map(flagObj => `flag:${flagObj.value}`);
		const payload = await db.getObjectsFields(keys, ['flagId', 'type', 'targetId', 'datetime']);

		[flags, bans, mutes] = await Promise.all([
			getFlagMetadata(payload),
			formatBanMuteData(bans, '[[user:info.banned-no-reason]]'),
			formatBanMuteData(mutes, '[[user:info.muted-no-reason]]'),
		]);

		return {
			flags: flags,
			bans: bans,
			mutes: mutes,
		};
	};

	User.getHistory = async function (set) {
		const data = await db.getSortedSetRevRangeWithScores(set, 0, -1);
		return data.map((set) => {
			set.timestamp = set.score;
			set.timestampISO = utils.toISOString(set.score);
			set.value = validator.escape(String(set.value.split(':')[0]));
			delete set.score;
			return set;
		});
	};

	async function getFlagMetadata(flags) {
		const postFlags = flags.filter(flag => flag && flag.type === 'post');
		const reports = await Promise.all(flags.map(flag => Flags.getReports(flag.flagId)));

		flags.forEach((flag, idx) => {
			if (flag) {
				flag.timestampISO = new Date(flag.datetime).toISOString();
				flag.reports = reports[idx];
			}
		});

		const pids = postFlags.map(flagObj => parseInt(flagObj.targetId, 10));
		const postData = await posts.getPostsFields(pids, ['tid']);
		const tids = postData.map(post => post.tid);

		const topicData = await topics.getTopicsFields(tids, ['title']);
		postFlags.forEach((flagObj, idx) => {
			flagObj.pid = flagObj.targetId;
			if (!tids[idx]) {
				flagObj.targetPurged = true;
			}
			return _.extend(flagObj, topicData[idx]);
		});
		return flags;
	}

	async function formatBanMuteData(keys, noReasonLangKey) {
		const data = await db.getObjects(keys);
		const uids = data.map(d => d.fromUid);
		const usersData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
		return data.map((banObj, index) => {
			banObj.user = usersData[index];
			banObj.until = parseInt(banObj.expire, 10);
			banObj.untilISO = utils.toISOString(banObj.until);
			banObj.timestampISO = utils.toISOString(banObj.timestamp);
			banObj.reason = validator.escape(String(banObj.reason || '')) || noReasonLangKey;
			return banObj;
		});
	}

	User.getModerationNotes = async function (uid, start, stop) {
		const noteIds = await db.getSortedSetRevRange(`uid:${uid}:moderation:notes`, start, stop);
		const keys = noteIds.map(id => `uid:${uid}:moderation:note:${id}`);
		const notes = await db.getObjects(keys);
		const uids = [];

		notes.forEach((note) => {
			if (note) {
				uids.push(note.uid);
				note.timestampISO = utils.toISOString(note.timestamp);
			}
		});
		const userData = await User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
		await Promise.all(notes.map(async (note, index) => {
			if (note) {
				note.note = await plugins.hooks.fire('filter:parse.raw', String(note.note));
				note.user = userData[index];
			}
		}));
		return notes;
	};

	User.appendModerationNote = async ({ uid, noteData }) => {
		await db.sortedSetAdd(`uid:${uid}:moderation:notes`, noteData.timestamp, noteData.timestamp);
		await db.setObject(`uid:${uid}:moderation:note:${noteData.timestamp}`, noteData);
	};
};
