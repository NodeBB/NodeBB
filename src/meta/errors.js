'use strict';

const nconf = require('nconf');
const winston = require('winston');
const validator = require('validator');
const { setTimeout } = require('timers/promises');

const db = require('../database');
const analytics = require('../analytics');
const pubsub = require('../pubsub');
const utils = require('../utils');
const cron = require('../cron');

const Errors = module.exports;

const runJobs = nconf.get('runJobs');

let counters = {};
let total = {};

Errors.init = async function () {
	await cron.addJob({
		name: 'errors:publish',
		cronTime: '0 * * * * *',
		runOnAllNodes: true,
		onTick: async () => {
			publishLocalErrors();
			if (runJobs) {
				await setTimeout(2000);
				await Errors.writeData();
			}
		},
	});

	if (runJobs) {
		pubsub.on('errors:publish', (data) => {
			for (const [key, value] of Object.entries(data.local)) {
				if (utils.isNumber(value)) {
					total[key] = total[key] || 0;
					total[key] += value;
				}
			}
		});
	}
};

function publishLocalErrors() {
	pubsub.publish('errors:publish', {
		local: counters,
	});
	counters = {};
}

Errors.writeData = async function () {
	try {
		const _counters = { ...total };
		total = {};
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

	analytics.increment('errors:404');

	route = route.slice(0, 512).replace(/\/$/, ''); // remove trailing slashes
	const segments = route.split('/');
	const containsUUID = segments.some((segment) => {
		const cleanSegment = segment.split('.')[0];
		return validator.isUUID(cleanSegment);
	});
	if (containsUUID) {
		return;
	}

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
