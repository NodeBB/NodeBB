'use strict';

const meta = require('../../meta');
const digest = require('../../user/digest');

const digestController = module.exports;

digestController.get = async function (req, res) {
	const [delivery] = await Promise.all([
		// digests.getStats(),
		digest.getDeliveryTimes(),
	]);


	res.render('admin/manage/digest', {
		title: '[[admin/menu:manage/digest]]',
		delivery: delivery,
		default: meta.config.dailyDigestFreq,
	});
};
