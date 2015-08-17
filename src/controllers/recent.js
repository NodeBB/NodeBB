
'use strict';

var nconf = require('nconf'),
	topics = require('../topics'),
	meta = require('../meta'),
	helpers = require('./helpers'),
	plugins = require('../plugins');

var recentController = {};

recentController.get = function(req, res, next) {

	var stop = (parseInt(meta.config.topicsPerList, 10) || 20) - 1;

	topics.getTopicsFromSet('topics:recent', req.uid, 0, stop, function(err, data) {
		if (err) {
			return next(err);
		}

		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/recent.rss';
		data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[recent:title]]'}]);

		plugins.fireHook('filter:recent.build', {req: req, res: res, templateData: data}, function(err, data) {
			if (err) {
				return next(err);
			}
			res.render('recent', data.templateData);
		});
	});
};

module.exports = recentController;