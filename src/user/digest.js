'use strict';

const winston = require('winston');
const nconf = require('nconf');

const db = require('../database');
const batch = require('../batch');
const meta = require('../meta');
const user = require('./index');
const topics = require('../topics');
const messaging = require('../messaging');
const plugins = require('../plugins');
const emailer = require('../emailer');
const utils = require('../utils');

const Digest = module.exports;

const baseUrl = nconf.get('base_url');

Digest.execute = async function (payload) {
	const digestsDisabled = meta.config.disableEmailSubscriptions === 1;
	if (digestsDisabled) {
		winston.info(`[user/jobs] Did not send digests (${payload.interval}) because subscription system is disabled.`);
		return false;
	}
	let { subscribers } = payload;
	if (!subscribers) {
		subscribers = await Digest.getSubscribers(payload.interval);
	}
	if (!subscribers.length) {
		return false;
	}
	try {
		winston.info(`[user/jobs] Digest (${payload.interval}) scheduling completed (${subscribers.length} subscribers). Sending emails; this may take some time...`);
		await Digest.send({
			interval: payload.interval,
			subscribers: subscribers,
		});
		winston.info(`[user/jobs] Digest (${payload.interval}) complete.`);
		return true;
	} catch (err) {
		winston.error(`[user/jobs] Could not send digests (${payload.interval})\n${err.stack}`);
		throw err;
	}
};

Digest.getUsersInterval = async (uids) => {
	// Checks whether user specifies digest setting, or false for system default setting
	let single = false;
	if (!Array.isArray(uids) && !isNaN(parseInt(uids, 10))) {
		uids = [uids];
		single = true;
	}

	const settings = await db.getObjects(uids.map(uid => `user:${uid}:settings`));
	const interval = uids.map((uid, index) => (settings[index] && settings[index].dailyDigestFreq) || false);
	return single ? interval[0] : interval;
};

Digest.getSubscribers = async function (interval) {
	let subscribers = [];

	await batch.processSortedSet('users:joindate', async (uids) => {
		const settings = await user.getMultipleUserSettings(uids);
		let subUids = [];
		settings.forEach((hash) => {
			if (hash.dailyDigestFreq === interval) {
				subUids.push(hash.uid);
			}
		});
		subUids = await user.bans.filterBanned(subUids);
		subscribers = subscribers.concat(subUids);
	}, {
		interval: 1000,
		batch: 500,
	});

	const results = await plugins.hooks.fire('filter:digest.subscribers', {
		interval: interval,
		subscribers: subscribers,
	});
	return results.subscribers;
};

Digest.send = async function (data) {
	let emailsSent = 0;
	if (!data || !data.subscribers || !data.subscribers.length) {
		return emailsSent;
	}
	let errorLogged = false;
	await batch.processArray(data.subscribers, async (uids) => {
		let userData = await user.getUsersFields(uids, ['uid', 'email', 'email:confirmed', 'username', 'userslug', 'lastonline']);
		userData = userData.filter(u => u && u.email && (meta.config.includeUnverifiedEmails || u['email:confirmed']));
		if (!userData.length) {
			return;
		}
		await Promise.all(userData.map(async (userObj) => {
			const [publicRooms, notifications, topics] = await Promise.all([
				getUnreadPublicRooms(userObj.uid),
				user.notifications.getUnreadInterval(userObj.uid, data.interval),
				getTermTopics(data.interval, userObj.uid),
			]);
			const unreadNotifs = notifications.filter(Boolean);
			// If there are no notifications and no new topics and no unread chats, don't bother sending a digest
			if (!unreadNotifs.length &&
				!topics.top.length && !topics.popular.length && !topics.recent.length &&
				!publicRooms.length) {
				return;
			}

			unreadNotifs.forEach((n) => {
				if (n.image && !n.image.startsWith('http')) {
					n.image = baseUrl + n.image;
				}
				if (n.path) {
					n.notification_url = n.path.startsWith('http') ? n.path : baseUrl + n.path;
				}
			});

			emailsSent += 1;
			const now = new Date();
			await emailer.send('digest', userObj.uid, {
				subject: `[[email:digest.subject, ${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}]]`,
				username: userObj.username,
				userslug: userObj.userslug,
				notifications: unreadNotifs,
				publicRooms: publicRooms,
				recent: topics.recent,
				topTopics: topics.top,
				popularTopics: topics.popular,
				interval: data.interval,
				showUnsubscribe: true,
			}).catch((err) => {
				if (!errorLogged) {
					winston.error(`[user/jobs] Could not send digest email\n[emailer.send] ${err.stack}`);
					errorLogged = true;
				}
			});
		}));
		if (data.interval !== 'alltime') {
			const now = Date.now();
			await db.sortedSetAdd('digest:delivery', userData.map(() => now), userData.map(u => u.uid));
		}
	}, {
		interval: 1000,
		batch: 100,
	});
	winston.info(`[user/jobs] Digest (${data.interval}) sending completed. ${emailsSent} emails sent.`);
	return emailsSent;
};

Digest.getDeliveryTimes = async (start, stop) => {
	const count = await db.sortedSetCard('users:joindate');
	const uids = await user.getUidsFromSet('users:joindate', start, stop);
	if (!uids.length) {
		return [];
	}

	const [scores, settings] = await Promise.all([
		// Grab the last time a digest was successfully delivered to these uids
		db.sortedSetScores('digest:delivery', uids),
		// Get users' digest settings
		Digest.getUsersInterval(uids),
	]);

	// Populate user data
	let userData = await user.getUsersFields(uids, ['username', 'picture']);
	userData = userData.map((user, idx) => {
		user.lastDelivery = scores[idx] ? new Date(scores[idx]).toISOString() : '[[admin/manage/digest:null]]';
		user.setting = settings[idx];
		return user;
	});

	return {
		users: userData,
		count: count,
	};
};

async function getTermTopics(term, uid) {
	const data = await topics.getSortedTopics({
		uid: uid,
		start: 0,
		stop: 199,
		term: term,
		sort: 'posts',
		teaserPost: 'first',
	});
	data.topics = data.topics.filter(topic => topic && !topic.deleted);

	const popular = data.topics
		.filter(t => t.postcount > 1)
		.sort((a, b) => b.postcount - a.postcount)
		.slice(0, 10);
	const popularTids = popular.map(t => t.tid);

	const top = data.topics
		.filter(t => t.votes > 0 && !popularTids.includes(t.tid))
		.sort((a, b) => b.votes - a.votes)
		.slice(0, 10);
	const topTids = top.map(t => t.tid);

	const recent = data.topics
		.filter(t => !topTids.includes(t.tid) && !popularTids.includes(t.tid))
		.sort((a, b) => b.lastposttime - a.lastposttime)
		.slice(0, 10);

	[...top, ...popular, ...recent].forEach((topicObj) => {
		if (topicObj) {
			if (topicObj.teaser && topicObj.teaser.content && topicObj.teaser.content.length > 255) {
				topicObj.teaser.content = `${topicObj.teaser.content.slice(0, 255)}...`;
			}
			// Fix relative paths in topic data
			const user = topicObj.hasOwnProperty('teaser') && topicObj.teaser && topicObj.teaser.user ?
				topicObj.teaser.user : topicObj.user;
			if (user && user.picture && utils.isRelativeUrl(user.picture)) {
				user.picture = baseUrl + user.picture;
			}
		}
	});
	return { top, popular, recent };
}

async function getUnreadPublicRooms(uid) {
	const publicRooms = await messaging.getPublicRooms(uid, uid);
	return publicRooms.filter(r => r && r.unread);
}
