'use strict';

const async = require('async');
const winston = require('winston');
const nconf = require('nconf');

const db = require('../database');
const batch = require('../batch');
const meta = require('../meta');
const user = require('./index');
const topics = require('../topics');
const plugins = require('../plugins');
const emailer = require('../emailer');
const utils = require('../utils');

const Digest = module.exports;

Digest.execute = async function (payload) {
	const digestsDisabled = meta.config.disableEmailSubscriptions === 1;
	if (digestsDisabled) {
		winston.info(`[user/jobs] Did not send digests (${payload.interval}) because subscription system is disabled.`);
		return;
	}
	let subscribers = payload.subscribers;
	if (!subscribers) {
		subscribers = await Digest.getSubscribers(payload.interval);
	}
	if (!subscribers.length) {
		return;
	}
	try {
		winston.info(`[user/jobs] Digest (${payload.interval}) scheduling completed. Sending emails; this may take some time...`);
		await Digest.send({
			interval: payload.interval,
			subscribers: subscribers,
		});
		winston.info(`[user/jobs] Digest (${payload.interval}) complete.`);
	} catch (err) {
		winston.error(`[user/jobs] Could not send digests (${payload.interval})\n${err.stack}`);
		throw err;
	}
};

Digest.getUsersInterval = async (uids) => {
	// Checks whether user specifies digest setting, or null/false for system default setting
	let single = false;
	if (!Array.isArray(uids) && !isNaN(parseInt(uids, 10))) {
		uids = [uids];
		single = true;
	}

	const settings = await Promise.all([
		db.isSortedSetMembers('digest:day:uids', uids),
		db.isSortedSetMembers('digest:week:uids', uids),
		db.isSortedSetMembers('digest:month:uids', uids),
	]);

	const interval = uids.map((uid, index) => {
		if (settings[0][index]) {
			return 'day';
		} else if (settings[1][index]) {
			return 'week';
		} else if (settings[2][index]) {
			return 'month';
		}
		return false;
	});

	return single ? interval[0] : interval;
};

Digest.getSubscribers = async function (interval) {
	var subscribers = [];

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

	await async.eachLimit(data.subscribers, 100, async (uid) => {
		const userObj = await user.getUserFields(uid, ['uid', 'username', 'userslug', 'lastonline']);
		const [notifications, topTopics, popularTopics, recentTopics] = await Promise.all([
			user.notifications.getUnreadInterval(userObj.uid, data.interval),
			getTermTopics(data.interval, userObj.uid, 0, 9, 'votes'),
			getTermTopics(data.interval, userObj.uid, 0, 9, 'posts'),
			getTermTopics(data.interval, userObj.uid, 0, 9, 'recent'),
		]);
		const unreadNotifs = notifications.filter(Boolean);
		// If there are no notifications and no new topics, don't bother sending a digest
		if (!unreadNotifs.length && !topTopics.length && !popularTopics.length && !recentTopics.length) {
			return;
		}

		unreadNotifs.forEach((n) => {
			if (n.image && !n.image.startsWith('http')) {
				n.image = nconf.get('base_url') + n.image;
			}
			if (n.path) {
				n.notification_url = n.path.startsWith('http') ? n.path : nconf.get('base_url') + n.path;
			}
		});

		emailsSent += 1;
		const now = new Date();
		await emailer.send('digest', userObj.uid, {
			subject: `[[email:digest.subject, ${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}]]`,
			username: userObj.username,
			userslug: userObj.userslug,
			notifications: unreadNotifs,
			recent: recentTopics,
			topTopics: topTopics,
			popularTopics: popularTopics,
			interval: data.interval,
			showUnsubscribe: true,
		}).catch(err => winston.error(`[user/jobs] Could not send digest email\n[emailer.send] ${err.stack}`));

		if (data.interval !== 'alltime') {
			await db.sortedSetAdd('digest:delivery', now.getTime(), userObj.uid);
		}
	});
	winston.info(`[user/jobs] Digest (${data.interval}) sending completed. ${emailsSent} emails sent.`);
};

Digest.getDeliveryTimes = async (start, stop) => {
	const count = await db.sortedSetCard('users:joindate');
	const uids = await user.getUidsFromSet('users:joindate', start, stop);
	if (!uids) {
		return [];
	}

	// Grab the last time a digest was successfully delivered to these uids
	const scores = await db.sortedSetScores('digest:delivery', uids);

	// Get users' digest settings
	const settings = await Digest.getUsersInterval(uids);

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

async function getTermTopics(term, uid, start, stop, sort) {
	const options = {
		uid: uid,
		start: start,
		stop: stop,
		term: term,
		sort: sort,
		teaserPost: 'last-post',
	};
	const data = sort === 'recent' ?
		await topics.getLatestTopics(options) :
		await topics.getSortedTopics(options);

	data.topics.forEach((topicObj) => {
		if (topicObj) {
			if (topicObj.teaser && topicObj.teaser.content && topicObj.teaser.content.length > 255) {
				topicObj.teaser.content = `${topicObj.teaser.content.slice(0, 255)}...`;
			}
			// Fix relative paths in topic data
			const user = topicObj.hasOwnProperty('teaser') && topicObj.teaser && topicObj.teaser.user ?
				topicObj.teaser.user : topicObj.user;
			if (user && user.picture && utils.isRelativeUrl(user.picture)) {
				user.picture = nconf.get('base_url') + user.picture;
			}
		}
	});
	return data.topics.filter(topic => topic && !topic.deleted);
}
