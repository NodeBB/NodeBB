'use strict';

const winston = require('winston');
const db = require('../database');
const meta = require('../meta');
const cron = require('../cron');

const jobs = {};

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

		User.stopJobs();

		await startDigestJob('digest.daily', `0 ${digestHour} * * *`, 'day');
		await startDigestJob('digest.weekly', `0 ${digestHour} * * 0`, 'week');
		await startDigestJob('digest.monthly', `0 ${digestHour} 1 * *`, 'month');

		jobs['reset.clean'] = await cron.addJob({
			name: 'user:reset:clean',
			cronTime: '0 0 * * *',
			onTick: User.reset.clean,
		});

		await cron.addJob({
			name: 'user:autoApprove',
			cronTime: '0 * * * *',
			onTick: User.autoApprove,
		});

		winston.verbose(`[user/jobs] jobs started`);
	};

	async function startDigestJob(name, cronString, term) {
		const newJob = await cron.addJob({
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
		if (newJob) {
			jobs[name] = newJob;
		}
	}

	User.stopJobs = function () {
		let terminated = 0;
		// Terminate any active cron jobs
		for (const [name, job] of Object.entries(jobs)) {
			winston.info(`[user/jobs] Terminating job (${name})`);
			if (job) {
				job.stop();
				delete jobs[name];
			}

			terminated += 1;
		}
		if (terminated > 0) {
			winston.info(`[user/jobs] ${terminated} jobs terminated`);
		}
	};
};
