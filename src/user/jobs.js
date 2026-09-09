'use strict';

const winston = require('winston');
const db = require('../database');
const meta = require('../meta');
const cron = require('../cron');

module.exports = function (User) {
	User.startJobs = async function () {
		winston.verbose('[user/jobs] (Re-)starting jobs...');

		let { digestHour } = meta.config;

		// Fix digest hour if invalid
		if (isNaN(digestHour)) {
			digestHour = 17;
		} else if (digestHour > 23 || digestHour < 0) {
			digestHour = 0;
		}

		await restartDigestJob('digest.daily', `0 ${digestHour} * * *`, 'day');
		await restartDigestJob('digest.weekly', `0 ${digestHour} * * 0`, 'week');
		await restartDigestJob('digest.monthly', `0 ${digestHour} 1 * *`, 'month');

		if (!cron.hasJob('user:reset:clean')) {
			await cron.addJob({
				name: 'user:reset:clean',
				cronTime: '0 0 * * *',
				onTick: User.reset.clean,
			});
		}

		if (!cron.hasJob('user:autoApprove')) {
			await cron.addJob({
				name: 'user:autoApprove',
				cronTime: '0 * * * *',
				onTick: User.autoApprove,
			});
		}

		winston.verbose(`[user/jobs] jobs started`);
	};

	async function restartDigestJob(name, cronString, term) {
		await cron.restartJob({
			name,
			cronTime: cronString,
			onTick: async () => {
				winston.verbose(`[user/jobs] Digest job (${name}) started.`);
				if (name === 'digest.weekly') {
					const counter = await db.increment('biweeklydigestcounter');
					if (counter % 2) {
						await User.digest.execute({ interval: 'biweek' });
					}
				}
				await User.digest.execute({ interval: term });
			},
		});
	}
};
