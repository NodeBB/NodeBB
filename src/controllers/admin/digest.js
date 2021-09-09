'use strict';

const meta = require('../../meta');
const digest = require('../../user/digest');
const pagination = require('../../pagination');

const digestController = module.exports;

digestController.get = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const resultsPerPage = 50;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;
	const delivery = await digest.getDeliveryTimes(start, stop);

	const pageCount = Math.ceil(delivery.count / resultsPerPage);
	res.render('admin/manage/digest', {
		title: '[[admin/menu:manage/digest]]',
		delivery: delivery.users,
		default: meta.config.dailyDigestFreq,
		pagination: pagination.create(page, pageCount),
	});
};
