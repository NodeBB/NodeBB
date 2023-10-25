'use strict';

const validator = require('validator');
const winston = require('winston');
const cronJob = require('cron').CronJob;

const db = require('../database');
const meta = require('../meta');
const emailer = require('../emailer');
const notifications = require('../notifications');
const groups = require('../groups');
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');

module.exports = function (User) {
	new cronJob('0 * * * *', (() => {
		User.autoApprove();
	}), null, true);

	User.addToApprovalQueue = async function (userData) {
		userData.username = userData.username.trim();
		userData.userslug = slugify(userData.username);
		await canQueue(userData);
		const hashedPassword = await User.hashPassword(userData.password);
		const data = {
			username: userData.username,
			email: userData.email,
			ip: userData.ip,
			hashedPassword: hashedPassword,
		};
		const results = await plugins.hooks.fire('filter:user.addToApprovalQueue', { data: data, userData: userData });
		await db.setObject(`registration:queue:name:${userData.username}`, results.data);
		await db.sortedSetAdd('registration:queue', Date.now(), userData.username);
		await sendNotificationToAdmins(userData.username);
	};

	async function canQueue(userData) {
		await User.isDataValid(userData);
		const usernames = await db.getSortedSetRange('registration:queue', 0, -1);
		if (usernames.includes(userData.username)) {
			throw new Error('[[error:username-taken]]');
		}
		const keys = usernames.filter(Boolean).map(username => `registration:queue:name:${username}`);
		const data = await db.getObjectsFields(keys, ['email']);
		const emails = data.map(data => data && data.email).filter(Boolean);
		if (userData.email && emails.includes(userData.email)) {
			throw new Error('[[error:email-taken]]');
		}
	}

	async function sendNotificationToAdmins(username) {
		const notifObj = await notifications.create({
			type: 'new-register',
			bodyShort: `[[notifications:new-register, ${username}]]`,
			nid: `new-register:${username}`,
			path: '/admin/manage/registration',
			mergeId: 'new-register',
		});
		await notifications.pushGroup(notifObj, 'administrators');
	}

	User.acceptRegistration = async function (username) {
		const userData = await db.getObject(`registration:queue:name:${username}`);
		if (!userData) {
			throw new Error('[[error:invalid-data]]');
		}
		const creation_time = await db.sortedSetScore('registration:queue', username);
		const uid = await User.create(userData);
		await User.setUserFields(uid, {
			password: userData.hashedPassword,
			'password:shaWrapped': 1,
		});
		await removeFromQueue(username);
		await markNotificationRead(username);
		await plugins.hooks.fire('filter:register.complete', { uid: uid });
		await emailer.send('registration_accepted', uid, {
			username: username,
			subject: `[[email:welcome-to, ${meta.config.title || meta.config.browserTitle || 'NodeBB'}]]`,
			template: 'registration_accepted',
			uid: uid,
		}).catch(err => winston.error(`[emailer.send] ${err.stack}`));
		const total = await db.incrObjectFieldBy('registration:queue:approval:times', 'totalTime', Math.floor((Date.now() - creation_time) / 60000));
		const counter = await db.incrObjectField('registration:queue:approval:times', 'counter');
		await db.setObjectField('registration:queue:approval:times', 'average', total / counter);
		return uid;
	};

	async function markNotificationRead(username) {
		const nid = `new-register:${username}`;
		const uids = await groups.getMembers('administrators', 0, -1);
		const promises = uids.map(uid => notifications.markRead(nid, uid));
		await Promise.all(promises);
	}

	User.rejectRegistration = async function (username) {
		await removeFromQueue(username);
		await markNotificationRead(username);
	};

	async function removeFromQueue(username) {
		await Promise.all([
			db.sortedSetRemove('registration:queue', username),
			db.delete(`registration:queue:name:${username}`),
		]);
	}

	User.shouldQueueUser = async function (ip) {
		const { registrationApprovalType } = meta.config;
		if (registrationApprovalType === 'admin-approval') {
			return true;
		} else if (registrationApprovalType === 'admin-approval-ip') {
			const count = await db.sortedSetCard(`ip:${ip}:uid`);
			return !!count;
		}
		return false;
	};

	User.getRegistrationQueue = async function (start, stop) {
		const data = await db.getSortedSetRevRangeWithScores('registration:queue', start, stop);
		const keys = data.filter(Boolean).map(user => `registration:queue:name:${user.value}`);
		let users = await db.getObjects(keys);
		users = users.filter(Boolean).map((user, index) => {
			user.timestampISO = utils.toISOString(data[index].score);
			user.email = validator.escape(String(user.email));
			user.usernameEscaped = validator.escape(String(user.username));
			delete user.hashedPassword;
			return user;
		});
		await Promise.all(users.map(async (user) => {
			// temporary: see http://www.stopforumspam.com/forum/viewtopic.php?id=6392
			// need to keep this for getIPMatchedUsers
			user.ip = user.ip.replace('::ffff:', '');
			await getIPMatchedUsers(user);
			user.customActions = user.customActions || [];
			/*
				// then spam prevention plugins, using the "filter:user.getRegistrationQueue" hook can be like:
				user.customActions.push({
					title: '[[spam-be-gone:report-user]]',
					id: 'report-spam-user-' + user.username,
					class: 'btn-warning report-spam-user',
					icon: 'fa-flag'
				});
			 */
		}));

		const results = await plugins.hooks.fire('filter:user.getRegistrationQueue', { users: users });
		return results.users;
	};

	async function getIPMatchedUsers(user) {
		const uids = await User.getUidsFromSet(`ip:${user.ip}:uid`, 0, -1);
		user.ipMatch = await User.getUsersFields(uids, ['uid', 'username', 'picture']);
	}

	User.autoApprove = async function () {
		if (meta.config.autoApproveTime <= 0) {
			return;
		}
		const users = await db.getSortedSetRevRangeWithScores('registration:queue', 0, -1);
		const now = Date.now();
		for (const user of users.filter(user => now - user.score >= meta.config.autoApproveTime * 3600000)) {
			// eslint-disable-next-line no-await-in-loop
			await User.acceptRegistration(user.value);
		}
	};
};
