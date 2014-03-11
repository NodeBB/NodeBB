"use strict";

var path = require('path'),
	async = require('async'),
	fs = require('fs'),
	nconf = require('nconf'),

	user = require('./../user'),
	topics = require('./../topics'),
	posts = require('./../posts'),
	categories = require('./../categories'),
	meta = require('./../meta'),
	plugins = require('./../plugins'),
	utils = require('./../../public/src/utils'),
	pkg = require('./../../package.json');



function upload(req, res, filesIterator, next) {
	if(!req.user) {
		return res.json(403, {message:'not allowed'});
	}
	var files = req.files.files;

	if(!Array.isArray(files)) {
		return res.json(500, {message: 'invalid files'});
	}

	if(Array.isArray(files[0])) {
		files = files[0];
	}

	function deleteTempFiles() {
		for(var i=0; i<files.length; ++i) {
			fs.unlink(files[i].path);
		}
	}

	async.map(files, filesIterator, function(err, images) {
		deleteTempFiles();

		if(err) {
			return res.send(500, err.message);
		}

		// IE8 - send it as text/html so browser won't trigger a file download for the json response
		// malsup.com/jquery/form/#file-upload
		res.send(200, req.xhr ? images : JSON.stringify(images));
	});
}

function uploadPost(req, res, next) {
	upload(req, res, function(file, next) {
		if(file.type.match(/image./)) {
			posts.uploadPostImage(file, next);
		} else {
			posts.uploadPostFile(file, next);
		}
	}, next);
}

function uploadThumb(req, res, next) {
	upload(req, res, function(file, next) {
		if(file.type.match(/image./)) {
			topics.uploadTopicThumb(file, next);
		} else {
			res.json(500, {message: 'Invalid File'});
		}
	}, next);
}

function getModerators(req, res, next) {
	categories.getModerators(req.params.cid, function(err, moderators) {
		res.json({moderators: moderators});
	});
}

function getTemplatesListing(req, res, next) {
	utils.walk(nconf.get('views_dir'), function (err, data) {
		data = data
				.filter(function(value, index, self) {
					return self.indexOf(value) === index;
				}).map(function(el) {
					return el.replace(nconf.get('views_dir') + '/', '');
				});

		res.json(data);
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
	app.namespace('/api', function () {
		app.get('/config', controllers.api.getConfig);

		app.get('/user/uid/:uid', middleware.checkGlobalPrivacySettings, controllers.accounts.getUserByUID);
		app.get('/get_templates_listing', getTemplatesListing);
		app.get('/categories/:cid/moderators', getModerators);
		app.get('/recent/posts/:term?', getRecentPosts);

		app.post('/post/upload', uploadPost);
		app.post('/topic/thumb/upload', uploadThumb);
	});

	// this should be in the API namespace
	// also, perhaps pass in :userslug so we can use checkAccountPermissions middleware - in future will allow admins to upload a picture for a user
	app.post('/user/uploadpicture', middleware.authenticate, middleware.checkGlobalPrivacySettings, /*middleware.checkAccountPermissions,*/ controllers.accounts.uploadPicture);
};
