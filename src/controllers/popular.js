
'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var helpers = require('./helpers');
var recentController = require('./recent');

var popularController = module.exports;

popularController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			recentController.getData(req, 'popular', 'posts', next);
		},
		function (data, next) {
			if (!data) {
				return next();
			}
			var term = helpers.terms[req.query.term] || 'alltime';
			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/popular') || req.originalUrl.startsWith(nconf.get('relative_path') + '/popular')) {
				data.title = '[[pages:popular-' + term + ']]';
				var breadcrumbs = [{ text: '[[global:header.popular]]' }];
				data.breadcrumbs = helpers.buildBreadcrumbs(breadcrumbs);
			}
			var feedQs = data.rssFeedUrl.split('?')[1];
			data.rssFeedUrl = nconf.get('relative_path') + '/popular/' + (validator.escape(String(req.query.term)) || 'alltime') + '.rss';
			if (req.loggedIn) {
				data.rssFeedUrl += '?' + feedQs;
			}
			res.render('popular', data);
		},
	], next);
};
