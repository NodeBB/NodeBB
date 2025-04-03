'use strict';

const winston = require('winston');
const validator = require('validator');
const cronJob = require('cron').CronJob;

const db = require('../database');
const analytics = require('../analytics');

const Errors = module.exports;

let counters = {};

new cronJob('0 * * * * *', (() => {
	Errors.writeData();
}), null, true);

Errors.writeData = async function () {
	try {
		const _counters = { ...counters };
		counters = {};
		const keys = Object.keys(_counters);
		if (!keys.length) {
			return;
		}

		const bulkIncrement = [];
		for (const key of keys) {
			bulkIncrement.push(['errors:404', _counters[key], key ]);
		}
		await db.sortedSetIncrByBulk(bulkIncrement);
	} catch (err) {
		winston.error(err.stack);
	}
};

Errors.log404 = function (route) {
	if (!route) {
		return;
	}
	route = route.slice(0, 512).replace(/\/$/, ''); // remove trailing slashes
	analytics.increment('errors:404');
	counters[route] = counters[route] || 0;
	counters[route] += 1;
};

Errors.get = async function (escape) {
	const data = await db.getSortedSetRevRangeWithScores('errors:404', 0, 199);
	data.forEach((nfObject) => {
		nfObject.value = escape ? validator.escape(String(nfObject.value || '')) : nfObject.value;
	});
	return data;
};

Errors.clear = async function () {
	await db.delete('errors:404');
};
