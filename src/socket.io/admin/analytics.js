'use strict';

const analytics = require('../../analytics');
const utils = require('../../utils');

const Analytics = module.exports;

Analytics.get = async function (socket, data) {
	if (!data || !data.graph || !data.units) {
		throw new Error('[[error:invalid-data]]');
	}

	// Default returns views from past 24 hours, by hour
	if (!data.amount) {
		if (data.units === 'days') {
			data.amount = 30;
		} else {
			data.amount = 24;
		}
	}
	const getStats = data.units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;
	if (data.graph === 'traffic') {
		const result = await utils.promiseParallel({
			uniqueVisitors: getStats('analytics:uniquevisitors', data.until || Date.now(), data.amount),
			pageviews: getStats('analytics:pageviews', data.until || Date.now(), data.amount),
			pageviewsRegistered: getStats('analytics:pageviews:registered', data.until || Date.now(), data.amount),
			pageviewsGuest: getStats('analytics:pageviews:guest', data.until || Date.now(), data.amount),
			pageviewsBot: getStats('analytics:pageviews:bot', data.until || Date.now(), data.amount),
			summary: analytics.getSummary(),
		});
		result.pastDay = result.pageviews.reduce((a, b) => parseInt(a, 10) + parseInt(b, 10));
		const last = result.pageviews.length - 1;
		result.pageviews[last] = parseInt(result.pageviews[last], 10) + analytics.getUnwrittenPageviews();
		return result;
	}
};
