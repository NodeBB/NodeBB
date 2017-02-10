'use strict';

var winston = require('winston');
var cronJob = require('cron').CronJob;

var meta = require('../meta');

var jobs = {};

module.exports = function (User) {
	User.startJobs = function (callback) {
		winston.verbose('[user/jobs] (Re-)starting user jobs...');
		var terminated = 0;
		var started = 0;
		var digestHour = parseInt(meta.config.digestHour, 10);

		// Fix digest hour if invalid
		if (isNaN(digestHour)) {
			digestHour = 17;
		} else if (digestHour > 23 || digestHour < 0) {
			digestHour = 0;
		}

		// Terminate any active cron jobs
		for(var jobId in jobs) {
			if (jobs.hasOwnProperty(jobId)) {
				winston.verbose('[user/jobs] Terminating job (' + jobId + ')');
				jobs[jobId].stop();
				delete jobs[jobId];
				++terminated;
			}
		}
		winston.verbose('[user/jobs] ' + terminated + ' jobs terminated');

		jobs['digest.daily'] = new cronJob('0 ' + digestHour + ' * * *', function () {
			winston.verbose('[user/jobs] Digest job (daily) started.');
			User.digest.execute('day');
		}, null, true);
		winston.verbose('[user/jobs] Starting job (digest.daily)');
		++started;

		jobs['digest.weekly'] = new cronJob('0 ' + digestHour + ' * * 0', function () {
			winston.verbose('[user/jobs] Digest job (weekly) started.');
			User.digest.execute('week');
		}, null, true);
		winston.verbose('[user/jobs] Starting job (digest.weekly)');
		++started;

		jobs['digest.monthly'] = new cronJob('0 ' + digestHour + ' 1 * *', function () {
			winston.verbose('[user/jobs] Digest job (monthly) started.');
			User.digest.execute('month');
		}, null, true);
		winston.verbose('[user/jobs] Starting job (digest.monthly)');
		++started;

		jobs['reset.clean'] = new cronJob('0 0 * * *', User.reset.clean, null, true);
		winston.verbose('[user/jobs] Starting job (reset.clean)');
		++started;

		winston.verbose('[user/jobs] ' + started + ' jobs started');

		if (typeof callback === 'function') {
			callback();
		}

		return;
	};
};

