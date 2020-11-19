'use strict';

// var winston = require('winston');
// var cronJob = require('cron').CronJob;

// const plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.startJobs = function () {
		console.log('topic start jobs');
	};
};
