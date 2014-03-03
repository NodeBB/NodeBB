"use strict";

var path = require('path'),
	async = require('async'),
	fs = require('fs'),

	db = require('./../database'),
	user = require('./../user'),
	topics = require('./../topics'),
	posts = require('./../posts'),
	categories = require('./../categories'),
	meta = require('./../meta'),
	plugins = require('./../plugins'),
	utils = require('./../../public/src/utils'),
	pkg = require('./../../package.json');


module.exports =  function(app, middleware, controllers) {
	app.namespace('/api', function () {
		app.all('*', function(req, res, next) {
			if(req.user) {
				user.updateLastOnlineTime(req.user.uid);
			}

			db.sortedSetAdd('ip:recent', Date.now(), req.ip || 'Unknown');
			res.locals.isAPI = true;

			next();
		});

		app.get('/user/uid/:uid', middleware.checkGlobalPrivacySettings, controllers.accounts.getUserByUID);

		app.get('/get_templates_listing', function (req, res) {
			utils.walk(path.join(__dirname, '../../', 'public/templates'), function (err, data) {
				res.json(data.concat(app.get_custom_templates()).filter(function(value, index, self) {
					return self.indexOf(value) === index;
				}));
			});
		});

		app.get('/config', controllers.api.getConfig);

		app.get('/search/:term', function (req, res, next) {
			if (!plugins.hasListeners('filter:search.query')) {
				return res.redirect('/404');
			}

			function searchPosts(callback) {
				plugins.fireHook('filter:search.query', {
					index: 'post',
					query: req.params.term
				}, function(err, pids) {
					if (err) {
						return callback(err);
					}

					posts.getPostSummaryByPids(pids, false, callback);
				});
			}

			function searchTopics(callback) {
				plugins.fireHook('filter:search.query', {
					index: 'topic',
					query: req.params.term
				}, function(err, tids) {
					if (err) {
						return callback(err);
					}

					topics.getTopicsByTids(tids, 0, callback);
				});
			}

			if ((req.user && req.user.uid) || meta.config.allowGuestSearching === '1') {
				async.parallel([searchPosts, searchTopics], function (err, results) {
					if (err) {
						return next(err);
					}

					if(!results) {
						results = [];
						results[0] = results[1] = [];
					}

					return res.json({
						show_no_topics: results[1].length ? 'hide' : '',
						show_no_posts: results[0].length ? 'hide' : '',
						show_results: '',
						search_query: req.params.term,
						posts: results[0],
						topics: results[1],
						post_matches : results[0].length,
						topic_matches : results[1].length
					});
				});
			} else {
				res.send(403);
			}
		});

		function upload(req, res, filesIterator, next) {
			if(!req.user) {
				return res.json(403, {message:'not allowed'});
			}
			var files = req.files.files;

			if(!Array.isArray(files)) {
				return res.json(500, {message: 'invalid files'});
			}

			// multiple files
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

				// if this was not a XMLHttpRequest (hence the req.xhr check http://expressjs.com/api.html#req.xhr)
				// then most likely it's submit via the iFrame workaround, via the jquery.form plugin's ajaxSubmit()
				// we need to send it as text/html so IE8 won't trigger a file download for the json response
				// malsup.com/jquery/form/#file-upload

				// Also, req.send is safe for both types, if the response was an object, res.send will automatically submit as application/json
				// expressjs.com/api.html#res.send
				res.send(200, req.xhr ? images : JSON.stringify(images));
			});
		}

		app.post('/post/upload', function(req, res, next) {
			upload(req, res, function(file, next) {
				if(file.type.match(/image./)) {
					posts.uploadPostImage(file, next);
				} else {
					posts.uploadPostFile(file, next);
				}
			}, next);
		});

		app.post('/topic/thumb/upload', function(req, res, next) {
			upload(req, res, function(file, next) {
				if(file.type.match(/image./)) {
					topics.uploadTopicThumb(file, next);
				} else {
					res.json(500, {message: 'Invalid File'});
				}
			}, next);
		});

		app.get('/categories/:cid/moderators', function(req, res) {
			categories.getModerators(req.params.cid, function(err, moderators) {
				res.json({moderators: moderators});
			});
		});
	});

	// this should be in the API namespace
	// also, perhaps pass in :userslug so we can use checkAccountPermissions middleware - in future will allow admins to upload a picture for a user
	app.post('/user/uploadpicture', middleware.authenticate, middleware.checkGlobalPrivacySettings, /*middleware.checkAccountPermissions,*/ controllers.accounts.uploadPicture);
};