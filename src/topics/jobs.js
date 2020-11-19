'use strict';

var winston = require('winston');
var cronJob = require('cron').CronJob;

const topics = require('.');

module.exports = function (Topics) {
	Topics.startJobs = function () {
		winston.verbose('[topics/jobs] (Re-)starting jobs...');
		new cronJob('5 * * * *', async () => {
			winston.verbose('[topics/jobs] Checking for expired pins...');
			const expireCount = await topics.tools.findExpiredPins();
			winston.verbose(`[topics/jobs] Found ${expireCount} expired pin(s).`);
		}, null, true);
	};
};
