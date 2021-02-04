'use strict';

const path = require('path');
const crypto = require('crypto');
const util = require('util');

const bcrypt = require('bcryptjs');

const fork = require('./meta/debugFork');

function forkChild(message, callback) {
	const child = fork(path.join(__dirname, 'password'));

	child.on('message', (msg) => {
		callback(msg.err ? new Error(msg.err) : null, msg.result);
	});

	child.send(message);
}

const forkChildAsync = util.promisify(forkChild);

exports.hash = async function (rounds, password) {
	password = crypto.createHash('sha512').update(password).digest('hex');
	return await forkChildAsync({ type: 'hash', rounds: rounds, password: password });
};

exports.compare = async function (password, hash, shaWrapped) {
	const fakeHash = await getFakeHash();

	if (shaWrapped) {
		password = crypto.createHash('sha512').update(password).digest('hex');
	}

	return await forkChildAsync({ type: 'compare', password: password, hash: hash || fakeHash });
};

let fakeHashCache;
async function getFakeHash() {
	if (fakeHashCache) {
		return fakeHashCache;
	}
	fakeHashCache = await exports.hash(12, Math.random().toString());
	return fakeHashCache;
}

// child process
process.on('message', (msg) => {
	if (msg.type === 'hash') {
		tryMethod(hashPassword, msg);
	} else if (msg.type === 'compare') {
		tryMethod(compare, msg);
	}
});

async function tryMethod(method, msg) {
	try {
		const result = await method(msg);
		process.send({ result: result });
	} catch (err) {
		process.send({ err: err.message });
	} finally {
		process.disconnect();
	}
}

async function hashPassword(msg) {
	const salt = await bcrypt.genSalt(parseInt(msg.rounds, 10));
	const hash = await bcrypt.hash(msg.password, salt);
	return hash;
}

async function compare(msg) {
	return await bcrypt.compare(String(msg.password || ''), String(msg.hash || ''));
}

require('./promisify')(exports);
