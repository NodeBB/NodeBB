'use strict';

const path = require('path');
const crypto = require('crypto');
const workerpool = require('workerpool');

const pool = workerpool.pool(
	path.join(__dirname, '/password_worker.js'), {
		minWorkers: 1,
	}
);

exports.hash = async function (rounds, password) {
	password = crypto.createHash('sha512').update(password).digest('hex');
	return await pool.exec('hash', [password, rounds]);
};

exports.compare = async function (password, hash, shaWrapped) {
	const fakeHash = await getFakeHash();

	if (shaWrapped) {
		password = crypto.createHash('sha512').update(password).digest('hex');
	}
	return await pool.exec('compare', [password, hash || fakeHash]);
};

let fakeHashCache;
async function getFakeHash() {
	if (fakeHashCache) {
		return fakeHashCache;
	}
	fakeHashCache = await exports.hash(12, Math.random().toString());
	return fakeHashCache;
}

require('./promisify')(exports);
