"use strict";

var path = require('path'),
	async = require('async'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express'),

	user = require('../user'),
	topics = require('../topics'),
	posts = require('../posts'),
	categories = require('../categories'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	image = require('../image'),
	pkg = require('../../package.json');


function deleteTempFiles(files) {
	for(var i=0; i<files.length; ++i) {
		fs.unlink(files[i].path);
	}
}

function upload(req, res, filesIterator, next) {
	var files = req.files.files;

	if (!req.user) {
		deleteTempFiles(files);
		return res.json(403, 'not allowed');
	}

	if (!Array.isArray(files)) {
		return res.json(500, 'invalid files');
	}

	if (Array.isArray(files[0])) {
		files = files[0];
	}

	async.map(files, filesIterator, function(err, images) {
		deleteTempFiles(files);

		if (err) {
			return res.status(500).send(err.message);
		}

		// IE8 - send it as text/html so browser won't trigger a file download for the json response
		// malsup.com/jquery/form/#file-upload
		res.status(200).send(req.xhr ? images : JSON.stringify(images));
	});
}

function uploadPost(req, res, next) {
	upload(req, res, function(file, next) {
		if(file.type.match(/image./)) {
			uploadImage(file, next);
		} else {
			uploadFile(file, next);
		}
	}, next);
}

function uploadThumb(req, res, next) {
	if (parseInt(meta.config.allowTopicsThumbnail, 10) !== 1) {
		deleteTempFiles(req.files.files);
		return next(new Error('[[error:topic-thumbnails-are-disabled]]'));
	}

	upload(req, res, function(file, next) {
		if(file.type.match(/image./)) {
			var size = meta.config.topicThumbSize || 120;
			image.resizeImage(file.path, path.extname(file.name), size, size, function(err) {
				if (err) {
					return next(err);
				}
				uploadImage(file, next);
			});
		} else {
			next(new Error('[[error:invalid-file]]'));
		}
	}, next);
}


function uploadImage(image, callback) {
	if(plugins.hasListeners('filter:uploadImage')) {
		plugins.fireHook('filter:uploadImage', image, callback);
	} else {

		if (parseInt(meta.config.allowFileUploads, 10)) {
			uploadFile(image, callback);
		} else {
			callback(new Error('[[error:uploads-are-disabled]]'));
		}
	}
}

function uploadFile(file, callback) {
	if(plugins.hasListeners('filter:uploadFile')) {
		plugins.fireHook('filter:uploadFile', file, callback);
	} else {

		if(parseInt(meta.config.allowFileUploads, 10) !== 1) {
			return callback(new Error('[[error:uploads-are-disabled]]'));
		}

		if(!file) {
			return callback(new Error('[[error:invalid-file]]'));
		}

		if(file.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
			return callback(new Error('[[error:file-too-big, ' + meta.config.maximumFileSize + ']]'));
		}

		var filename = 'upload-' + utils.generateUUID() + path.extname(file.name);
		require('../file').saveFileToLocal(filename, 'files', file.path, function(err, upload) {
			if(err) {
				return callback(err);
			}

			callback(null, {
				url: upload.url,
				name: file.name
			});
		});
	}
}


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
				config = JSON.parse(config.toString());
				plugins.fireHook('filter:templates.get_config', config, next);
			});
		},
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		var data = [];
		data = results.views.filter(function(value, index, self) {
					return self.indexOf(value) === index;
				}).map(function(el) {
					return el.replace(nconf.get('views_dir') + '/', '');
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

module.exports =  function(app, middleware, controllers) {

	var router = express.Router();
	app.use('/api', router);

	router.get('/config', controllers.api.getConfig);
	router.get('/widgets/render', controllers.api.renderWidgets);

	router.get('/user/uid/:uid', middleware.checkGlobalPrivacySettings, controllers.accounts.getUserByUID);
	router.get('/get_templates_listing', getTemplatesListing);
	router.get('/categories/:cid/moderators', getModerators);
	router.get('/recent/posts/:term?', getRecentPosts);

	router.post('/post/upload', middleware.applyCSRF, uploadPost);
	router.post('/topic/thumb/upload', middleware.applyCSRF, uploadThumb);
	router.post('/user/:userslug/uploadpicture', middleware.applyCSRF, middleware.authenticate, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.uploadPicture);

};
