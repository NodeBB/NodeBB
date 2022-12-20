'use strict';

import winston from 'winston';
import validator from 'validator';
import {  CronJob } from 'cron';
const cronJob = CronJob;
import db from '../database';
import analytics from '../analytics';

const Errors = {} as any;

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

		for (const key of keys) {
			/* eslint-disable no-await-in-loop */
			await db.sortedSetIncrBy('errors:404', _counters[key], key);
		}
	} catch (err: any) {
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

export default Errors;