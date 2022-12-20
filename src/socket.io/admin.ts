'use strict';

import winston from 'winston';
import meta from '../meta';
import user from '../user';
import events from '../events';
import db from '../database';
import privileges from '../privileges';
import websockets from './index';
import index from './index';
import search from '../admin/search';

const getAdminSearchDict = search.getLatestVersionDictionary;

const SocketAdmin = {} as any;

import adminUser from './admin/user';
import categories from './admin/categories';
import adminSettings from './admin/settings';
import tags from './admin/tags';
import rewards from './admin/rewards';
import navigation from './admin/navigation';
import rooms from './admin/rooms';
import social from './admin/social';
import plugins from './admin/plugins';
import widgets from './admin/widgets';
import config from './admin/config';
import settings from './admin/settings';
import email from './admin/email';
import analytics from './admin/analytics';
import logs from './admin/logs';
import errors from './admin/errors';
import digest from './admin/digest';
import cache from './admin/cache';

Object.assign(SocketAdmin, { 
	user,
	categories,
	settings,
	tags,
	rewards,
	navigation,
	rooms,
	social,
	plugins,
	widgets,
	config,
	adminSettings,
	email,
	analytics,
	logs,
	errors,
	digest,
	cache,
});

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

SocketAdmin.deleteAllSessions = function (socket, data, callback) {
	user.auth.deleteAllSessions(callback);
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

import promisify from '../promisify';
promisify(SocketAdmin);

export default SocketAdmin;
