
'use strict';

var nconf = require('nconf');

var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');

var recentController = {};

recentController.get = function(req, res, next) {

	var stop = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;

	topics.getTopicsFromSet('topics:recent', req.uid, 0, stop, function(err, data) {
		if (err) {
			return next(err);
		}

		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/recent.rss';
		data.title = '[[pages:recent]]';
		if (req.path.startsWith('/api/recent') || req.path.startsWith('/recent')) {
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[recent:title]]'}]);
		}

		res.render('recent', data);
	});
};

module.exports = recentController;