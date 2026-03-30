'use strict';

const jobsController = module.exports;

const cron = require('../../cron');

jobsController.get = async function (req, res) {
	const jobs = await cron.getJobs();

	res.render('admin/advanced/jobs', { jobs });
};

