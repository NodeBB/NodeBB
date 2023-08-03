
'use strict';

const user = require('../user');
const meta = require('../meta');
const events = require('../events');

const SocketBlacklist = module.exports;

SocketBlacklist.validate = async function (socket, data) {
	return meta.blacklist.validate(data.rules);
};

SocketBlacklist.save = async function (socket, rules) {
	await blacklist(socket, 'save', rules);
};

SocketBlacklist.addRule = async function (socket, rule) {
	await blacklist(socket, 'addRule', rule);
};

async function blacklist(socket, method, rule) {
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(socket.uid);
	if (!isAdminOrGlobalMod) {
		throw new Error('[[error:no-privileges]]');
	}
	if (socket.ip && rule.includes(socket.ip)) {
		throw new Error('[[error:cant-blacklist-self-ip]]');
	}

	await meta.blacklist[method](rule);
	await events.log({
		type: `ip-blacklist-${method}`,
		uid: socket.uid,
		ip: socket.ip,
		rule: rule,
	});
}

require('../promisify')(SocketBlacklist);
