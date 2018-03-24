
'use strict';

var async = require('async');
var nconf = require('nconf');

var topics = require('../topics');
var meta = require('../meta');
var user = require('../user');
var helpers = require('./helpers');
var pagination = require('../pagination');

var popularController = module.exports;

var anonCache = {};
var lastUpdateTime = 0;

var terms = {
	daily: 'day',
	weekly: 'week',
	monthly: 'month',
};

popularController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
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

	if (!req.loggedIn) {
		if (anonCache[term] && anonCache[term][page] && (Date.now() - lastUpdateTime) < 60 * 60 * 1000) {
			return res.render('popular', anonCache[term][page]);
		}
	}
	var settings;
	async.waterfall([
		function (next) {
			user.getSettings(req.uid, next);
		},
		function (_settings, next) {
			settings = _settings;
			var start = Math.max(0, (page - 1) * settings.topicsPerPage);
			var stop = start + settings.topicsPerPage - 1;
			topics.getPopularTopics(term, req.uid, start, stop, next);
		},
		function (data) {
			var pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));

			data.title = meta.config.homePageTitle || '[[pages:home]]';
			data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
			data.rssFeedUrl = nconf.get('relative_path') + '/popular/' + (req.params.term || 'alltime') + '.rss';
			data.term = term;
			data.pagination = pagination.create(page, pageCount, req.query);

			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/popular') || req.originalUrl.startsWith(nconf.get('relative_path') + '/popular')) {
				data.title = '[[pages:popular-' + term + ']]';
				var breadcrumbs = [{ text: termToBreadcrumb[term] }];

				if (req.params.term) {
					breadcrumbs.unshift({ text: '[[global:header.popular]]', url: '/popular' });
				}

				data.breadcrumbs = helpers.buildBreadcrumbs(breadcrumbs);
			}

			if (!req.loggedIn) {
				anonCache[term] = anonCache[term] || {};
				anonCache[term][page] = data;
				lastUpdateTime = Date.now();
			}

			res.render('popular', data);
		},
	], next);
};
