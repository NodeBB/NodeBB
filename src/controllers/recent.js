
'use strict';

var nconf = require('nconf');
var async = require('async');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');
var plugins = require('../plugins');

var recentController = {};

recentController.get = function(req, res, next) {

	var stop = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;

	async.waterfall([
		function (next) {
			topics.getTopicsFromSet('topics:recent', req.uid, 0, stop, next);
		},
		function (data, next) {
			data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
			data.rssFeedUrl = nconf.get('relative_path') + '/recent.rss';
			data.title = '[[pages:recent]]';
			if (req.path.startsWith('/api/recent') || req.path.startsWith('/recent')) {
				data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[recent:title]]'}]);
			}

			plugins.fireHook('filter:recent.build', {req: req, res: res, templateData: data}, next);
		}
	], function(err, data) {
		if (err) {
			return next(err);
		}
		res.render('recent', data.templateData);
	});
};

module.exports = recentController;