'use strict';

const nconf = require('nconf');

nconf.argv().env({
	separator: '__',
});

const fs = require('fs');
const path = require('path');
const _ = require('lodash');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Alternate configuration file support
const configFile = path.resolve(__dirname, '../../../', nconf.any(['config', 'CONFIG']) || 'config.json');
const prestart = require('../../prestart');

prestart.loadConfig(configFile);
prestart.setupWinston();

const db = require('../../database');
const batch = require('../../batch');

process.on('message', async (msg) => {
	if (msg && msg.uid) {
		await db.init();
		await db.initSessionStore();

		const targetUid = msg.uid;

		const profileFile = `${targetUid}_profile.json`;
		const profilePath = path.join(__dirname, '../../../build/export', profileFile);

		const user = require('../index');
		const [
			userData,
			userSettings,
			ips,
			sessions,
			usernames,
			emails,
			bookmarks,
			watchedTopics,
			upvoted,
			downvoted,
			following,
		] = await Promise.all([
			db.getObject(`user:${targetUid}`),
			db.getObject(`user:${targetUid}:settings`),
			user.getIPs(targetUid, 9),
			user.auth.getSessions(targetUid),
			user.getHistory(`user:${targetUid}:usernames`),
			user.getHistory(`user:${targetUid}:emails`),
			getSetData(`uid:${targetUid}:bookmarks`, 'post:', targetUid),
			getSetData(`uid:${targetUid}:followed_tids`, 'topic:', targetUid),
			getSetData(`uid:${targetUid}:upvote`, 'post:', targetUid),
			getSetData(`uid:${targetUid}:downvote`, 'post:', targetUid),
			getSetData(`following:${targetUid}`, 'user:', targetUid),
		]);
		delete userData.password;

		let chatData = [];
		await batch.processSortedSet(`uid:${targetUid}:chat:rooms`, async (roomIds) => {
			const result = await Promise.all(roomIds.map(roomId => getRoomMessages(targetUid, roomId)));
			chatData = chatData.concat(_.flatten(result));
		}, { batch: 100, interval: 1000 });

		await fs.promises.writeFile(profilePath, JSON.stringify({
			user: userData,
			settings: userSettings,
			ips: ips,
			sessions: sessions,
			usernames: usernames,
			emails: emails,
			messages: chatData,
			bookmarks: bookmarks,
			watchedTopics: watchedTopics,
			upvoted: upvoted,
			downvoted: downvoted,
			following: following,
		}, null, 4));

		await db.close();
		process.exit(0);
	}
});

async function getRoomMessages(uid, roomId) {
	const batch = require('../../batch');
	let data = [];
	await batch.processSortedSet(`chat:room:${roomId}:mids`, async (mids) => {
		const messageData = await db.getObjects(mids.map(mid => `message:${mid}`));
		data = data.concat(
			messageData
				.filter(m => m && m.fromuid === uid && !m.system)
				.map(m => ({ content: m.content, timestamp: m.timestamp }))
		);
	}, { batch: 500, interval: 1000 });
	return data;
}

async function getSetData(set, keyPrefix, uid) {
	const privileges = require('../../privileges');
	const batch = require('../../batch');
	let data = [];
	await batch.processSortedSet(set, async (ids) => {
		if (keyPrefix === 'post:') {
			ids = await privileges.posts.filter('topics:read', ids, uid);
		} else if (keyPrefix === 'topic:') {
			ids = await privileges.topics.filterTids('topics:read', ids, uid);
		}
		let objData = await db.getObjects(ids.map(id => keyPrefix + id));
		if (keyPrefix === 'post:') {
			objData = objData.map(o => _.pick(o, ['pid', 'content', 'timestamp']));
		} else if (keyPrefix === 'topic:') {
			objData = objData.map(o => _.pick(o, ['tid', 'title', 'timestamp']));
		} else if (keyPrefix === 'user:') {
			objData = objData.map(o => _.pick(o, ['uid', 'username']));
		}
		data = data.concat(objData);
	}, { batch: 500, interval: 1000 });
	return data;
}
