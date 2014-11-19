
'use strict';

var winston = require('winston'),
	cronJob = require('cron').CronJob,

	user = require('../user'),
	meta = require('../meta');

module.exports = function(User) {
	User.startJobs = function() {
		new cronJob('0 0 17 * * *', function() {
			winston.verbose('[user.startJobs] Digest job (daily) started.');
			User.digest.execute('day');
		}, null, true);

		new cronJob('0 0 17 * * 0', function() {
			winston.verbose('[user.startJobs] Digest job (weekly) started.');
			User.digest.execute('week');
		}, null, true);

		new cronJob('0 0 17 1 * *', function() {
			winston.verbose('[user.startJobs] Digest job (monthly) started.');
			User.digest.execute('month');
		}, null, true);
	};
};

