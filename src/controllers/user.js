'use strict';

const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const json2csvAsync = require('json2csv').parseAsync;
const archiver = require('archiver');

const db = require('../database');
const user = require('../user');
const meta = require('../meta');
const posts = require('../posts');
const batch = require('../batch');
const events = require('../events');
const privileges = require('../privileges');
const accountHelpers = require('./accounts/helpers');

const userController = module.exports;

userController.getCurrentUser = async function (req, res) {
	if (!req.loggedIn) {
		return res.status(401).json('not-authorized');
	}
	const userslug = await user.getUserField(req.uid, 'userslug');
	const userData = await accountHelpers.getUserDataByUserSlug(userslug, req.uid);
	res.json(userData);
};

userController.getUserByUID = async function (req, res, next) {
	await byType('uid', req, res, next);
};

userController.getUserByUsername = async function (req, res, next) {
	await byType('username', req, res, next);
};

userController.getUserByEmail = async function (req, res, next) {
	await byType('email', req, res, next);
};

async function byType(type, req, res, next) {
	const userData = await userController.getUserDataByField(req.uid, type, req.params[type]);
	if (!userData) {
		return next();
	}
	res.json(userData);
}

userController.getUserDataByField = async function (callerUid, field, fieldValue) {
	let uid = null;
	if (field === 'uid') {
		uid = fieldValue;
	} else if (field === 'username') {
		uid = await user.getUidByUsername(fieldValue);
	} else if (field === 'email') {
		uid = await user.getUidByEmail(fieldValue);
	}
	if (!uid) {
		return null;
	}
	return await userController.getUserDataByUID(callerUid, uid);
};

userController.getUserDataByUID = async function (callerUid, uid) {
	if (!parseInt(uid, 10)) {
		throw new Error('[[error:no-user]]');
	}
	const canView = await privileges.global.can('view:users', callerUid);
	if (!canView) {
		throw new Error('[[error:no-privileges]]');
	}
	const [userData, settings] = await Promise.all([
		user.getUserData(uid),
		user.getSettings(uid),
	]);

	if (!userData) {
		throw new Error('[[error:no-user]]');
	}

	userData.email = settings.showemail && !meta.config.hideEmail ? userData.email : undefined;
	userData.fullname = settings.showfullname && !meta.config.hideFullname ? userData.fullname : undefined;

	return userData;
};

userController.exportPosts = async function (req, res) {
	var payload = [];
	await batch.processSortedSet('uid:' + res.locals.uid + ':posts', async function (pids) {
		let postData = await posts.getPostsData(pids);
		// Remove empty post references and convert newlines in content
		postData = postData.filter(Boolean).map(function (post) {
			post.content = '"' + String(post.content || '').replace(/\n/g, '\\n').replace(/"/g, '\\"') + '"';
			return post;
		});
		payload = payload.concat(postData);
	}, {
		batch: 500,
	});

	const fields = payload.length ? Object.keys(payload[0]) : [];
	const opts = { fields };
	const csv = await json2csvAsync(payload, opts);
	res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="' + res.locals.uid + '_posts.csv"').send(csv);
};

userController.exportUploads = function (req, res, next) {
	const targetUid = res.locals.uid;
	const archivePath = path.join(__dirname, '../../build/export', targetUid + '_uploads.zip');
	const archive = archiver('zip', {
		zlib: { level: 9 }, // Sets the compression level.
	});
	const maxAge = 1000 * 60 * 60 * 24;	// 1 day
	const rootDirectory = path.join(__dirname, '../../public/uploads/');
	const trimPath = function (path) {
		return path.replace(rootDirectory, '');
	};
	let isFresh = false;
	const sendFile = function () {
		events.log({
			type: 'export:uploads',
			uid: req.uid,
			targetUid: targetUid,
			ip: req.ip,
			fresh: isFresh,
		});

		res.sendFile(targetUid + '_uploads.zip', {
			root: path.join(__dirname, '../../build/export'),
			headers: {
				'Content-Disposition': 'attachment; filename=' + targetUid + '_uploads.zip',
				maxAge: maxAge,
			},
		});
	};

	// Check for existing file, if exists and is < 1 day in age, send this instead
	try {
		fs.accessSync(archivePath, fs.constants.F_OK | fs.constants.R_OK);
		isFresh = (Date.now() - fs.statSync(archivePath).mtimeMs) < maxAge;
		if (isFresh) {
			return sendFile();
		}
	} catch (err) {
		// File doesn't exist, continue
	}

	const output = fs.createWriteStream(archivePath);
	output.on('close', sendFile);

	archive.on('warning', function (err) {
		switch (err.code) {
			case 'ENOENT':
				winston.warn('[user/export/uploads] File not found: ' + trimPath(err.path));
				break;

			default:
				winston.warn('[user/export/uploads] Unexpected warning: ' + err.message);
				break;
		}
	});

	archive.on('error', function (err) {
		switch (err.code) {
			case 'EACCES':
				winston.error('[user/export/uploads] File inaccessible: ' + trimPath(err.path));
				break;

			default:
				winston.error('[user/export/uploads] Unable to construct archive: ' + err.message);
				break;
		}

		res.sendStatus(500);
	});

	archive.pipe(output);
	winston.verbose('[user/export/uploads] Collating uploads for uid ' + targetUid);
	user.collateUploads(targetUid, archive, function (err) {
		if (err) {
			return next(err);
		}

		archive.finalize();
	});
};

userController.exportProfile = async function (req, res) {
	const targetUid = parseInt(res.locals.uid, 10);
	const [userData, userSettings, ips, sessions, usernames, emails, bookmarks, watchedTopics, upvoted, downvoted, following] = await Promise.all([
		db.getObject('user:' + targetUid),
		db.getObject('user:' + targetUid + ':settings'),
		user.getIPs(targetUid, 9),
		user.auth.getSessions(targetUid, req.sessionID),
		user.getHistory('user:' + targetUid + ':usernames'),
		user.getHistory('user:' + targetUid + ':emails'),
		getSetData('uid:' + targetUid + ':bookmarks', 'post:', targetUid),
		getSetData('uid:' + targetUid + ':followed_tids', 'topic:', targetUid),
		getSetData('uid:' + targetUid + ':upvote', 'post:', targetUid),
		getSetData('uid:' + targetUid + ':downvote', 'post:', targetUid),
		getSetData('following:' + targetUid, 'user:', targetUid),
	]);
	delete userData.password;
	const followingData = following.map(u => ({ username: u.username, uid: u.uid }));

	let chatData = [];
	await batch.processSortedSet('uid:' + targetUid + ':chat:rooms', async (roomIds) => {
		var result = await Promise.all(roomIds.map(roomId => getRoomMessages(targetUid, roomId)));
		chatData = chatData.concat(_.flatten(result));
	}, { batch: 100 });

	res.set('Content-Type', 'application/json')
		.set('Content-Disposition', 'attachment; filename="' + targetUid + '_profile.json"')
		.send({
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
			following: followingData,
		});
};

async function getRoomMessages(uid, roomId) {
	let data = [];
	await batch.processSortedSet('uid:' + uid + ':chat:room:' + roomId + ':mids', async (mids) => {
		const messageData = await db.getObjects(mids.map(mid => 'message:' + mid));
		data = data.concat(messageData.filter(m => m && m.fromuid === uid && !m.system)
			.map(m => ({ content: m.content, timestamp: m.timestamp }))
		);
	}, { batch: 500 });
	return data;
}

async function getSetData(set, keyPrefix, uid) {
	let data = [];
	await batch.processSortedSet(set, async (ids) => {
		if (keyPrefix === 'post:') {
			ids = await privileges.posts.filter('topics:read', ids, uid);
		} else if (keyPrefix === 'topic:') {
			ids = await privileges.topics.filterTids('topics:read', ids, uid);
		}
		data = data.concat(await db.getObjects(ids.map(id => keyPrefix + id)));
	}, { batch: 500 });
	return data;
}

require('../promisify')(userController, [
	'getCurrentUser', 'getUserByUID', 'getUserByUsername', 'getUserByEmail',
	'exportPosts', 'exportUploads', 'exportProfile',
]);
