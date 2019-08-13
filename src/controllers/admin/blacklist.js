'use strict';

const meta = require('../../meta');
const analytics = require('../../analytics');

const blacklistController = module.exports;

blacklistController.get = async function (req, res) {
	const [rules, analyticsData] = await Promise.all([
		meta.blacklist.get(),
		analytics.getBlacklistAnalytics(),
	]);
	res.render('admin/manage/ip-blacklist', {
		title: '[[pages:ip-blacklist]]',
		rules: rules,
		analytics: analyticsData,
	});
};
