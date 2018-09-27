'use strict';

var async = require('async');
var path = require('path');
var fs = require('fs');
var winston = require('winston');
var converter = require('json-2-csv');
var archiver = require('archiver');

var db = require('../database');
var user = require('../user');
var meta = require('../meta');
var posts = require('../posts');
var batch = require('../batch');
var events = require('../events');
var accountHelpers = require('./accounts/helpers');

var userController = module.exports;

userController.getCurrentUser = function (req, res, next) {
	if (!req.loggedIn) {
		return res.status(401).json('not-authorized');
	}
	async.waterfall([
		function (next) {
			user.getUserField(req.uid, 'userslug', next);
		},
		function (userslug, next) {
			accountHelpers.getUserDataByUserSlug(userslug, req.uid, next);
		},
		function (userData) {
			res.json(userData);
		},
	], next);
};


userController.getUserByUID = function (req, res, next) {
	byType('uid', req, res, next);
};

userController.getUserByUsername = function (req, res, next) {
	byType('username', req, res, next);
};

userController.getUserByEmail = function (req, res, next) {
	byType('email', req, res, next);
};

function byType(type, req, res, next) {
	async.waterfall([
		function (next) {
			userController.getUserDataByField(req.uid, type, req.params[type], next);
		},
		function (data, next) {
			if (!data) {
				return next();
			}
			res.json(data);
		},
	], next);
}

userController.getUserDataByField = function (callerUid, field, fieldValue, callback) {
	async.waterfall([
		function (next) {
			if (field === 'uid') {
				next(null, fieldValue);
			} else if (field === 'username') {
				user.getUidByUsername(fieldValue, next);
			} else if (field === 'email') {
				user.getUidByEmail(fieldValue, next);
			} else {
				next(null, null);
			}
		},
		function (uid, next) {
			if (!uid) {
				return next(null, null);
			}
			userController.getUserDataByUID(callerUid, uid, next);
		},
	], callback);
};

userController.getUserDataByUID = function (callerUid, uid, callback) {
	if (!parseInt(callerUid, 10) && parseInt(meta.config.privateUserInfo, 10) === 1) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	if (!parseInt(uid, 10)) {
		return callback(new Error('[[error:no-user]]'));
	}

	async.parallel({
		userData: async.apply(user.getUserData, uid),
		settings: async.apply(user.getSettings, uid),
	}, function (err, results) {
		if (err || !results.userData) {
			return callback(err || new Error('[[error:no-user]]'));
		}

		results.userData.email = results.settings.showemail && parseInt(meta.config.hideEmail, 10) !== 1 ? results.userData.email : undefined;
		results.userData.fullname = results.settings.showfullname && parseInt(meta.config.hideFullname, 10) !== 1 ? results.userData.fullname : undefined;

		callback(null, results.userData);
	});
};

userController.exportPosts = function (req, res, next) {
	async.waterfall([
		function (next) {
			var payload = [];
			batch.processSortedSet('uid:' + res.locals.uid + ':posts', function (pids, next) {
				posts.getPostsData(pids, function (err, posts) {
					if (err) {
						return next(err);
					}

					// Remove empty post references and convert newlines in content
					posts = posts.filter(Boolean).map(function (post) {
						post.content = '"' + post.content.replace(/\n/g, '\\n').replace(/"/g, '\\"') + '"';
						return post;
					});

					payload = payload.concat(posts);
					next();
				});
			}, function (err) {
				next(err, payload);
			});
		},
		function (payload, next) {
			converter.json2csv(payload, next, {
				checkSchemaDifferences: false,
				emptyFieldValue: '',
			});
		},
		function (csv) {
			res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="' + req.params.uid + '_posts.csv"').send(csv);
		},
	], next);
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

userController.exportProfile = function (req, res, next) {
	const targetUid = res.locals.uid;
	async.waterfall([
		async.apply(db.getObjects.bind(db), ['user:' + targetUid, 'user:' + targetUid + ':settings']),
		function (objects, next) {
			Object.assign(objects[0], objects[1]);
			delete objects[0].password;

			converter.json2csv(objects[0], next);
		},
		function (csv) {
			res.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="' + targetUid + '_profile.csv"').send(csv);
		},
	], next);
};
