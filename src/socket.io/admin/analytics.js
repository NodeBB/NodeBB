'use strict';

const async = require('async');
const analytics = require('../../analytics');

const Analytics = module.exports;

Analytics.get = function (socket, data, callback) {
	if (!data || !data.graph || !data.units) {
		return callback(new Error('[[error:invalid-data]]'));
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
		async.parallel({
			uniqueVisitors: function (next) {
				getStats('analytics:uniquevisitors', data.until || Date.now(), data.amount, next);
			},
			pageviews: function (next) {
				getStats('analytics:pageviews', data.until || Date.now(), data.amount, next);
			},
			pageviewsRegistered: function (next) {
				getStats('analytics:pageviews:registered', data.until || Date.now(), data.amount, next);
			},
			pageviewsGuest: function (next) {
				getStats('analytics:pageviews:guest', data.until || Date.now(), data.amount, next);
			},
			pageviewsBot: function (next) {
				getStats('analytics:pageviews:bot', data.until || Date.now(), data.amount, next);
			},
			summary: function (next) {
				analytics.getSummary(next);
			},
		}, (err, data) => {
			data.pastDay = data.pageviews.reduce((a, b) => parseInt(a, 10) + parseInt(b, 10));
			data.pageviews[data.pageviews.length - 1] = parseInt(data.pageviews[data.pageviews.length - 1], 10) + analytics.getUnwrittenPageviews();
			callback(err, data);
		});
	}
};
