"use strict";

var path = require('path'),
	async = require('async'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express'),

	posts = require('../posts'),
	categories = require('../categories'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	uploadsController = require('../controllers/uploads');


module.exports =  function(app, middleware, controllers) {

	var router = express.Router();
	app.use('/api', router);

	router.get('/config', middleware.applyCSRF, controllers.api.getConfig);
	router.get('/widgets/render', controllers.api.renderWidgets);

	router.get('/user/uid/:uid', middleware.checkGlobalPrivacySettings, controllers.accounts.getUserByUID);
	router.get('/get_templates_listing', getTemplatesListing);
	router.get('/categories/:cid/moderators', getModerators);
	router.get('/recent/posts/:term?', getRecentPosts);

	var multipart = require('connect-multiparty');
	var multipartMiddleware = multipart();

	router.post('/post/upload', multipartMiddleware, middleware.applyCSRF, uploadsController.uploadPost);
	router.post('/topic/thumb/upload', multipartMiddleware, middleware.applyCSRF, uploadsController.uploadThumb);
	router.post('/user/:userslug/uploadpicture', multipartMiddleware, middleware.applyCSRF, middleware.authenticate, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.uploadPicture);
};

function getModerators(req, res, next) {
	categories.getModerators(req.params.cid, function(err, moderators) {
		res.json({moderators: moderators});
	});
}

var templatesListingCache = {};

function getTemplatesListing(req, res, next) {
	if (templatesListingCache.availableTemplates && templatesListingCache.templatesConfig) {
		return res.json(templatesListingCache);
	}

	async.parallel({
		views: function(next) {
			utils.walk(nconf.get('views_dir'), next);
		},
		extended: function(next) {
			plugins.fireHook('filter:templates.get_virtual', [], next);
		},
		config: function(next) {
			fs.readFile(path.join(nconf.get('views_dir'), 'config.json'), function(err, config) {
				if (err) {
					return next(err);
				}

				try {
					config = JSON.parse(config.toString());
				} catch (err) {
					return next(err);
				}

				plugins.fireHook('filter:templates.get_config', config, next);
			});
		},
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		var data = results.views.filter(function(value, index, self) {
			return value && self.indexOf(value) === index;
		}).map(function(el) {
			return el && el.replace(nconf.get('views_dir') + '/', '');
		});

		data = data.concat(results.extended);

		templatesListingCache = {
			availableTemplates: data,
			templatesConfig: results.config
		};

		res.json(templatesListingCache);
	});
}

function getRecentPosts(req, res, next) {
	var uid = (req.user) ? req.user.uid : 0;

	posts.getRecentPosts(uid, 0, 19, req.params.term, function (err, data) {
		if(err) {
			return next(err);
		}

		res.json(data);
	});
}