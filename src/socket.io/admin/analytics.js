'use strict';

const async = require('async');
const analytics = require('../../analytics');

exports.get = async function (socket, data) {
	if (!data || !data.graph || !data.units) {
		throw Error('[[error:invalid-data]]');
	}

	// Default returns views from past 24 hours, by hour
	const amount = data.amount || (data.units === 'days' ? 30 : 24);
	const until = data.until || Date.now();
	const getStats = data.units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;

	if (data.graph === 'traffic') {
		const results = await async.parallel({
			async uniqueVisitors() {
				return await getStats('analytics:uniquevisitors', until, amount);
			},
			async pageviews() {
				return await getStats('analytics:pageviews', until, amount);
			},
			async pageviewsRegistered() {
				return await getStats('analytics:pageviews:registered', until, amount);
			},
			async pageviewsGuest() {
				return await getStats('analytics:pageviews:guest', until, amount);
			},
			async pageviewsBot() {
				return await getStats('analytics:pageviews:bot', until, amount);
			},
			async summary() {
				return await analytics.getSummary();
			},
		});



		results.pastDay = results.pageviews.reduce((a, b) => parseInt(a, 10) + parseInt(b, 10));
		const last = results.pageviews.length - 1;
		results.pageviews[last] = parseInt(results.pageviews[last], 10) + analytics.getUnwrittenPageviews();

		return results;
	}
};
