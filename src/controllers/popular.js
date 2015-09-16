
'use strict';

var nconf = require('nconf'),
	topics = require('../topics'),
	meta = require('../meta'),
	helpers = require('./helpers');

var popularController = {};

var anonCache = {}, lastUpdateTime = 0;

var terms = {
	daily: 'day',
	weekly: 'week',
	monthly: 'month',
	alltime: 'alltime'
};

popularController.get = function(req, res, next) {

	var term = terms[req.params.term] || 'day';

	if (!req.uid) {
		if (anonCache[term] && (Date.now() - lastUpdateTime) < 60 * 60 * 1000) {
			return res.render('popular', anonCache[term]);
		}
	}

	topics.getPopular(term, req.uid, meta.config.topicsPerList, function(err, topics) {
		if (err) {
			return next(err);
		}

		var data = {
			topics: topics,
			'feeds:disableRSS': parseInt(meta.config['feeds:disableRSS'], 10) === 1,
			rssFeedUrl: nconf.get('relative_path') + '/popular/' + (req.params.term || 'daily') + '.rss',
			title: '[[pages:popular-' + term + ']]'
		};

		if (req.path.startsWith('/api/popular') || req.path.startsWith('/popular')) {
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:header.popular]]'}]);
		}

		if (!req.uid) {
			anonCache[term] = data;
			lastUpdateTime = Date.now();
		}

		res.render('popular', data);
	});
};

module.exports = popularController;