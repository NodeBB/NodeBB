'use strict';

const path = require('path');
const crypto = require('crypto');
const workerpool = require('workerpool');

let pool;

function getOrCreatePool() {
	if (pool) return pool;
	pool = workerpool.pool(
		path.join(__dirname, '/password_worker.js'), {
			minWorkers: 1,
		}
	);
	return pool;
}

exports.hash = async function (rounds, password) {
	password = crypto.createHash('sha512').update(password).digest('hex');
	return await getOrCreatePool().exec('hash', [password, rounds]);
};

exports.compare = async function (password, hash, shaWrapped) {
	const fakeHash = await getFakeHash();

	if (shaWrapped) {
		password = crypto.createHash('sha512').update(password).digest('hex');
	}
	return await getOrCreatePool().exec('compare', [password, hash || fakeHash]);
};

let fakeHashCache;
async function getFakeHash() {
	if (fakeHashCache) {
		return fakeHashCache;
	}
	const length = 18;
	fakeHashCache = crypto.randomBytes(Math.ceil(length / 2))
		.toString('hex').slice(0, length);
	return fakeHashCache;
}

require('./promisify')(exports);
