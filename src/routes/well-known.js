'use strict';

const nconf = require('nconf');
const meta = require('../meta');
const db = require('../database');
const helpers = require('./helpers');

module.exports = function (app, middleware, controllers) {
	const url = nconf.get('url');
	const version = nconf.get('version');

	app.use('/.well-known/change-password', (req, res) => {
		res.redirect('/me/edit/password');
	});

	app.get('/.well-known/webfinger', helpers.tryRoute(controllers['well-known'].webfinger));

	app.get('/.well-known/nodeinfo', (req, res) => {
		res.json({
			links: [
				{
					rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
					href: `${url}/nodeinfo/2.0`,
				},
			],
		});
	});

	app.get('/nodeinfo/2.0(.json)?', helpers.tryRoute(async (req, res) => {
		const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

		function addMonths(input, months) {
			const date = new Date(input);
			date.setDate(1);
			date.setMonth(date.getMonth() + months);
			date.setDate(Math.min(input.getDate(), getDaysInMonth(date.getFullYear(), date.getMonth() + 1)));
			return date;
		}

		const oneMonthAgo = addMonths(new Date(), -1);
		const sixMonthsAgo = addMonths(new Date(), -6);

		const [{ postCount, topicCount, userCount }, activeMonth, activeHalfyear] = await Promise.all([
			db.getObjectFields('global', ['postCount', 'topicCount', 'userCount']),
			db.sortedSetCount('users:online', oneMonthAgo.getTime(), '+inf'),
			db.sortedSetCount('users:online', sixMonthsAgo.getTime(), '+inf'),
		]);

		res.json({
			version: '2.0',
			software: {
				name: 'NodeBB',
				version: version,
			},
			protocols: [
				'activitypub',
			],
			services: {
				outbound: [],
				inbound: [],
			},
			usage: {
				users: {
					total: userCount,
					activeMonth: activeMonth,
					activeHalfyear: activeHalfyear,
				},
				localPosts: topicCount,
				localComments: postCount - topicCount,
			},
			openRegistrations: meta.config.registrationType === 'normal',
			metadata: {
				nodeName: meta.config.title || 'NodeBB',
				nodeDescription: meta.config.description || '',
				federation: {
					enabled: !!meta.config.activitypubEnabled,
				},
			},
		});
	}));
};
