'use strict';

const async = require('async');
const winston = require('winston');
const nconf = require('nconf');

const batch = require('../batch');
const meta = require('../meta');
const user = require('../user');
const topics = require('../topics');
const plugins = require('../plugins');
const emailer = require('../emailer');
const utils = require('../utils');

const Digest = module.exports;

Digest.execute = async function (payload) {
	const digestsDisabled = meta.config.disableEmailSubscriptions === 1;
	if (digestsDisabled) {
		winston.info('[user/jobs] Did not send digests (' + payload.interval + ') because subscription system is disabled.');
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
		const count = await Digest.send({
			interval: payload.interval,
			subscribers: subscribers,
		});
		winston.info('[user/jobs] Digest (' + payload.interval + ') scheduling completed. ' + count + ' email(s) sent.');
	} catch (err) {
		winston.error('[user/jobs] Could not send digests (' + payload.interval + ')', err);
		throw err;
	}
};

Digest.getSubscribers = async function (interval) {
	var subscribers = [];

	await batch.processSortedSet('users:joindate', async function (uids) {
		const settings = await user.getMultipleUserSettings(uids);
		let subUids = [];
		settings.forEach(function (hash) {
			if (hash.dailyDigestFreq === interval) {
				subUids.push(hash.uid);
			}
		});
		subUids = await user.bans.filterBanned(subUids);
		subscribers = subscribers.concat(subUids);
	}, { interval: 1000 });

	const results = await plugins.fireHook('filter:digest.subscribers', {
		interval: interval,
		subscribers: subscribers,
	});
	return results.subscribers;
};

Digest.send = async function (data) {
	var emailsSent = 0;
	if (!data || !data.subscribers || !data.subscribers.length) {
		return emailsSent;
	}
	const now = new Date();

	const users = await user.getUsersFields(data.subscribers, ['uid', 'username', 'userslug', 'lastonline']);

	async.eachLimit(users, 100, async function (userObj) {
		let [notifications, topicsData] = await Promise.all([
			user.notifications.getUnreadInterval(userObj.uid, data.interval),
			getTermTopics(data.interval, userObj.uid, 0, 9),
		]);
		notifications = notifications.filter(Boolean);
		// If there are no notifications and no new topics, don't bother sending a digest
		if (!notifications.length && !topicsData.length) {
			return;
		}

		notifications.forEach(function (notification) {
			if (notification.image && !notification.image.startsWith('http')) {
				notification.image = nconf.get('url') + notification.image;
			}
		});

		// Fix relative paths in topic data
		topicsData = topicsData.map(function (topicObj) {
			const user = topicObj.hasOwnProperty('teaser') && topicObj.teaser !== undefined ? topicObj.teaser.user : topicObj.user;
			if (user && user.picture && utils.isRelativeUrl(user.picture)) {
				user.picture = nconf.get('base_url') + user.picture;
			}
			return topicObj;
		});
		emailsSent += 1;
		emailer.send('digest', userObj.uid, {
			subject: '[[email:digest.subject, ' + (now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate()) + ']]',
			username: userObj.username,
			userslug: userObj.userslug,
			notifications: notifications,
			recent: topicsData,
			interval: data.interval,
			showUnsubscribe: true,
		}, function (err) {
			if (err) {
				winston.error('[user/jobs] Could not send digest email', err);
			}
		});
	});
	return emailsSent;
};

async function getTermTopics(term, uid, start, stop) {
	const options = {
		uid: uid,
		start: start,
		stop: stop,
		term: term,
		sort: 'posts',
		teaserPost: 'last-post',
	};
	let data = await topics.getSortedTopics(options);
	if (!data.topics.length) {
		data = await topics.getLatestTopics(options);
	}
	data.topics.forEach(function (topicObj) {
		if (topicObj && topicObj.teaser && topicObj.teaser.content && topicObj.teaser.content.length > 255) {
			topicObj.teaser.content = topicObj.teaser.content.slice(0, 255) + '...';
		}
	});
	return data.topics;
}
