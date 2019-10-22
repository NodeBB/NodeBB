'use strict';

const path = require('path');
const fs = require('fs');
const winston = require('winston');
const converter = require('json-2-csv');
const archiver = require('archiver');
const util = require('util');

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

const json2csv = util.promisify(function (payload, options, callback) {
	converter.json2csv(payload, callback, options);
});

userController.exportPosts = async function (req, res) {
	var payload = [];
	await batch.processSortedSet('uid:' + res.locals.uid + ':posts', async function (pids) {
		let postData = await posts.getPostsData(pids);
		// Remove empty post references and convert newlines in content
		postData = postData.filter(Boolean).map(function (post) {
			post.content = '"' + post.content.replace(/\n/g, '\\n').replace(/"/g, '\\"') + '"';
			return post;
		});
		payload = payload.concat(postData);
	});
	const csv = await json2csv(payload, {
		checkSchemaDifferences: false,
		emptyFieldValue: '',
	});
	res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="' + req.params.uid + '_posts.csv"').send(csv);
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
	winston.info('[user/export/uploads] Collating uploads for uid ' + targetUid);
	user.collateUploads(targetUid, archive, function (err) {
		if (err) {
			return next(err);
		}

		archive.finalize();
	});
};

userController.exportProfile = async function (req, res) {
	const targetUid = res.locals.uid;
	const objects = await db.getObjects(['user:' + targetUid, 'user:' + targetUid + ':settings']);
	Object.assign(objects[0], objects[1]);
	delete objects[0].password;

	const csv = await json2csv(objects[0], {});
	res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="' + targetUid + '_profile.csv"').send(csv);
};

require('../promisify')(userController, [
	'getCurrentUser', 'getUserByUID', 'getUserByUsername', 'getUserByEmail',
	'exportPosts', 'exportUploads', 'exportProfile',
]);
