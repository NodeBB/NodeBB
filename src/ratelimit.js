'use strict';

const db = require('./database');

const Ratelimit = module.exports;

Ratelimit.check = async function (key, { window, max }) {
	const count = await db.increment(key);
	if (count === 1) {
		await db.pexpire(key, window);
	}
	return count <= max;
};

Ratelimit.clear = async function (key) {
	await db.delete(key);
};
