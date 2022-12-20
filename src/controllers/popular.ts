
'use strict';

import nconf from 'nconf';
import validator from 'validator';
import helpers from './helpers';
import recentController from './recent';

const popularController = {} as any;

popularController.get = async function (req, res, next) {
	const data = await recentController.getData(req, 'popular', 'posts');
	if (!data) {
		return next();
	}
	const term = helpers.terms[req.query.term] || 'alltime';
	if (req.originalUrl.startsWith(`${nconf.get('relative_path')}/api/popular`) || req.originalUrl.startsWith(`${nconf.get('relative_path')}/popular`)) {
		data.title = `[[pages:popular-${term}]]`;
		const breadcrumbs = [{ text: '[[global:header.popular]]' }];
		data.breadcrumbs = helpers.buildBreadcrumbs(breadcrumbs);
	}

	const feedQs = data.rssFeedUrl.split('?')[1];
	data.rssFeedUrl = `${nconf.get('relative_path')}/popular/${validator.escape(String(req.query.term || 'alltime'))}.rss`;
	if (req.loggedIn) {
		data.rssFeedUrl += `?${feedQs}`;
	}
	res.render('popular', data);
};

export default popularController;