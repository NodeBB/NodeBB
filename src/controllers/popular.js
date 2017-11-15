
'use strict';

var async = require('async');
var nconf = require('nconf');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');

var popularController = module.exports;

var anonCache = {};
var lastUpdateTime = 0;

var terms = {
	daily: 'day',
	weekly: 'week',
	monthly: 'month',
};

popularController.get = function (req, res, next) {
	var term = terms[req.params.term];

	if (!term && req.params.term) {
		return next();
	}
	term = term || 'alltime';

	var termToBreadcrumb = {
		day: '[[recent:day]]',
		week: '[[recent:week]]',
		month: '[[recent:month]]',
		alltime: '[[global:header.popular]]',
	};

	if (!req.uid) {
		if (anonCache[term] && (Date.now() - lastUpdateTime) < 60 * 60 * 1000) {
			return res.render('popular', anonCache[term]);
		}
	}

	async.waterfall([
		function (next) {
			topics.getPopular(term, req.uid, meta.config.topicsPerList, next);
		},
		function (topics) {
			var data = {
				topics: topics,
				'feeds:disableRSS': parseInt(meta.config['feeds:disableRSS'], 10) === 1,
				rssFeedUrl: nconf.get('relative_path') + '/popular/' + (req.params.term || 'daily') + '.rss',
				title: '[[pages:popular-' + term + ']]',
				term: term,
			};

			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/popular') || req.originalUrl.startsWith(nconf.get('relative_path') + '/popular')) {
				var breadcrumbs = [{ text: termToBreadcrumb[term] }];

				if (req.params.term) {
					breadcrumbs.unshift({ text: '[[global:header.popular]]', url: '/popular' });
				}

				data.breadcrumbs = helpers.buildBreadcrumbs(breadcrumbs);
			}

			if (!req.uid) {
				anonCache[term] = data;
				lastUpdateTime = Date.now();
			}

			res.render('popular', data);
		},
	], next);
};
