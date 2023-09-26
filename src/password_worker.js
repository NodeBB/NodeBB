'use strict';

const workerpool = require('workerpool');
const bcrypt = require('bcryptjs');

async function hash(password, rounds) {
	const salt = await bcrypt.genSalt(parseInt(rounds, 10));
	return await bcrypt.hash(password, salt);
}

async function compare(password, hash) {
	return await bcrypt.compare(String(password || ''), String(hash || ''));
}

workerpool.worker({
	hash: hash,
	compare: compare,
});
