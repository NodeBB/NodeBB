'use strict';

const winston = require('winston');

const meta = require('../meta');
const user = require('../user');
const events = require('../events');
const db = require('../database');
const privileges = require('../privileges');
const websockets = require('./index');
const batch = require('../batch');
const index = require('./index');
const getAdminSearchDict = require('../admin/search').getDictionary;

const SocketAdmin = module.exports;
SocketAdmin.user = require('./admin/user');
SocketAdmin.categories = require('./admin/categories');
SocketAdmin.settings = require('./admin/settings');
SocketAdmin.tags = require('./admin/tags');
SocketAdmin.rewards = require('./admin/rewards');
SocketAdmin.navigation = require('./admin/navigation');
SocketAdmin.rooms = require('./admin/rooms');
SocketAdmin.themes = require('./admin/themes');
SocketAdmin.plugins = require('./admin/plugins');
SocketAdmin.widgets = require('./admin/widgets');
SocketAdmin.config = require('./admin/config');
SocketAdmin.settings = require('./admin/settings');
SocketAdmin.email = require('./admin/email');
SocketAdmin.analytics = require('./admin/analytics');
SocketAdmin.logs = require('./admin/logs');
SocketAdmin.errors = require('./admin/errors');
SocketAdmin.digest = require('./admin/digest');
SocketAdmin.cache = require('./admin/cache');

SocketAdmin.before = async function (socket, method) {
	const isAdmin = await user.isAdministrator(socket.uid);
	if (isAdmin) {
		return;
	}

	// Check admin privileges mapping (if not in mapping, deny access)
	const privilegeSet = privileges.admin.socketMap.hasOwnProperty(method) ? privileges.admin.socketMap[method].split(';') : [];
	const hasPrivilege = (await Promise.all(privilegeSet.map(
		async privilege => privileges.admin.can(privilege, socket.uid)
	))).some(Boolean);
	if (privilegeSet.length && hasPrivilege) {
		return;
	}

	winston.warn(`[socket.io] Call to admin method ( ${method} ) blocked (accessed by uid ${socket.uid})`);
	throw new Error('[[error:no-privileges]]');
};

SocketAdmin.restart = async function (socket) {
	await logRestart(socket);
	meta.restart();
};

async function logRestart(socket) {
	await events.log({
		type: 'restart',
		uid: socket.uid,
		ip: socket.ip,
	});
	await db.setObject('lastrestart', {
		uid: socket.uid,
		ip: socket.ip,
		timestamp: Date.now(),
	});
}

SocketAdmin.reload = async function (socket) {
	await require('../meta/build').buildAll();
	await events.log({
		type: 'build',
		uid: socket.uid,
		ip: socket.ip,
	});

	await logRestart(socket);
	meta.restart();
};

SocketAdmin.fireEvent = function (socket, data, callback) {
	index.server.emit(data.name, data.payload || {});
	callback();
};

SocketAdmin.deleteEvents = function (socket, eids, callback) {
	events.deleteEvents(eids, callback);
};

SocketAdmin.deleteAllEvents = function (socket, data, callback) {
	events.deleteAll(callback);
};

SocketAdmin.getSearchDict = async function (socket) {
	const settings = await user.getSettings(socket.uid);
	const lang = settings.userLang || meta.config.defaultLang || 'en-GB';
	return await getAdminSearchDict(lang);
};

SocketAdmin.deleteAllSessions = async function () {
	await user.auth.deleteAllSessions();
};

SocketAdmin.reloadAllSessions = function (socket, data, callback) {
	websockets.in(`uid_${socket.uid}`).emit('event:livereload');
	callback();
};

SocketAdmin.getServerTime = function (socket, data, callback) {
	const now = new Date();

	callback(null, {
		timestamp: now.getTime(),
		offset: now.getTimezoneOffset(),
	});
};

SocketAdmin.clearSearchHistory = async function () {
	const keys = await db.scan({ match: 'searches:*' });
	await batch.processArray(keys, db.deleteAll, {
		batch: 500,
		interval: 0,
	});
};

require('../promisify')(SocketAdmin);
