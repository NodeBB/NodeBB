
'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var helpers = require('./helpers');
var recentController = require('./recent');

var topController = module.exports;

topController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			recentController.getData(req, 'top', 'votes', next);
		},
		function (data, next) {
			if (!data) {
				return next();
			}
			var term = helpers.terms[req.query.term] || 'alltime';
			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/top') || req.originalUrl.startsWith(nconf.get('relative_path') + '/top')) {
				data.title = '[[pages:top-' + term + ']]';
			}

			var feedQs = data.rssFeedUrl.split('?')[1];
			data.rssFeedUrl = nconf.get('relative_path') + '/top/' + (validator.escape(String(req.query.term)) || 'alltime') + '.rss';
			if (req.loggedIn) {
				data.rssFeedUrl += '?' + feedQs;
			}
			res.render('top', data);
		},
	], next);
};
