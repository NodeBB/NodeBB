
'use strict';

import nconf from 'nconf';
const validator = require('validator');

import helpers from './helpers';
const recentController = require('./recent');

const topController  = {} as any;

topController.get = async function (req, res, next) {
	const data = await recentController.getData(req, 'top', 'votes');
	if (!data) {
		return next();
	}
	const term = helpers.terms[req.query.term] || 'alltime';
	if (req.originalUrl.startsWith(`${nconf.get('relative_path')}/api/top`) || req.originalUrl.startsWith(`${nconf.get('relative_path')}/top`)) {
		data.title = `[[pages:top-${term}]]`;
	}

	const feedQs = data.rssFeedUrl.split('?')[1];
	data.rssFeedUrl = `${nconf.get('relative_path')}/top/${validator.escape(String(req.query.term || 'alltime'))}.rss`;
	if (req.loggedIn) {
		data.rssFeedUrl += `?${feedQs}`;
	}
	res.render('top', data);
};
