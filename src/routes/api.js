var path = require('path'),
	nconf = require('nconf'),
	async = require('async'),
	fs = require('fs'),

	db = require('../database'),
	user = require('../user'),
	groups = require('../groups'),
	auth = require('./authentication'),
	topics = require('../topics'),
	ThreadTools = require('../threadTools'),
	posts = require('../posts'),
	categories = require('../categories'),
	categoryTools = require('../categoryTools'),
	meta = require('../meta'),
	Plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	translator = require('../../public/src/translator'),
	pkg = require('../../package.json');


(function (Api) {
	Api.createRoutes = function (app) {

		app.namespace('/api', function () {
			app.all('*', function(req, res, next) {
				if(req.user) {
					user.updateLastOnlineTime(req.user.uid);
				}

				db.sortedSetAdd('ip:recent', Date.now(), req.ip || 'Unknown');
				res.locals.isAPI = true;

				next();
			});

			app.get('/get_templates_listing', function (req, res) {
				utils.walk(path.join(__dirname, '../../', 'public/templates'), function (err, data) {
					res.json(data.concat(app.get_custom_templates()).filter(function(value, index, self) {
						return self.indexOf(value) === index;
					}));
				});
			});

			app.get('/config', function (req, res, next) {
				var config = require('../../public/config.json');

				config.version = pkg.version;
				config.postDelay = meta.config.postDelay;
				config.minimumTitleLength = meta.config.minimumTitleLength;
				config.maximumTitleLength = meta.config.maximumTitleLength;
				config.minimumPostLength = meta.config.minimumPostLength;
				config.hasImageUploadPlugin = Plugins.hasListeners('filter:uploadImage');
				config.maximumProfileImageSize = meta.config.maximumProfileImageSize;
				config.minimumUsernameLength = meta.config.minimumUsernameLength;
				config.maximumUsernameLength = meta.config.maximumUsernameLength;
				config.minimumPasswordLength = meta.config.minimumPasswordLength;
				config.maximumSignatureLength = meta.config.maximumSignatureLength;
				config.useOutgoingLinksPage = parseInt(meta.config.useOutgoingLinksPage, 10) === 1;
				config.allowGuestPosting = parseInt(meta.config.allowGuestPosting, 10) === 1;
				config.allowFileUploads = parseInt(meta.config.allowFileUploads, 10) === 1;
				config.allowTopicsThumbnail = parseInt(meta.config.allowTopicsThumbnail, 10) === 1;
				config.usePagination = parseInt(meta.config.usePagination, 10) === 1;
				config.disableSocialButtons = parseInt(meta.config.disableSocialButtons, 10) === 1;
				config.topicsPerPage = meta.config.topicsPerPage || 20;
				config.postsPerPage = meta.config.postsPerPage || 20;
				config.maximumFileSize = meta.config.maximumFileSize;
				config.defaultLang = meta.config.defaultLang || 'en_GB';
				config.environment = process.env.NODE_ENV;

				if (!req.user) {
					return res.json(200, config);
				}

				if(req.user) {
					user.getSettings(req.user.uid, function(err, settings) {
						if(err) {
							return next(err);
						}

						config.usePagination = settings.usePagination;
						config.topicsPerPage = settings.topicsPerPage;
						config.postsPerPage = settings.postsPerPage;
						res.json(200, config);
					});
				}
			});

			app.get('/topic/:id/:slug?', function (req, res, next) {
				var uid = req.user? parseInt(req.user.uid, 10) : 0;
				var tid = req.params.id;
				var page = 1;
				if(req.query && req.query.page) {
					page = req.query.page;
				}

				if(!utils.isNumber(page) || parseInt(page, 10) < 1) {
					return res.send(404);
				}

				user.getSettings(uid, function(err, settings) {
					if(err) {
						return next(err);
					}

					var start = (page - 1) * settings.postsPerPage;
					var end = start + settings.postsPerPage - 1;

					ThreadTools.privileges(tid, uid, function(err, privileges) {
						if(err) {
							return next(err);
						}

						if(!privileges.read) {
							res.send(403);
						}

						topics.getTopicWithPosts(tid, uid, start, end, function (err, data) {
							if(err) {
								return next(err);
							}

							if(page > data.pageCount) {
								return res.send(404);
							}

							if (parseInt(data.deleted, 10) === 1 && parseInt(data.expose_tools, 10) === 0) {
								return res.json(404, {});
							}

							data.currentPage = page;
							data.privileges = privileges;

							if (uid) {
								topics.markAsRead(tid, uid, function(err) {
									topics.pushUnreadCount(uid);
								});
							}

							topics.increaseViewCount(tid);

							res.json(data);
						});
					});
				});
			});

			app.get('/category/:id/:slug?', function (req, res, next) {
				var uid = (req.user) ? req.user.uid : 0;
				var page = 1;
				if(req.query && req.query.page) {
					page = req.query.page;
				}

				if(!utils.isNumber(page) || parseInt(page, 10) < 1) {
					return res.send(404);
				}

				user.getSettings(uid, function(err, settings) {
					if(err) {
						return next(err);
					}

					var start = (page - 1) * settings.topicsPerPage,
						end = start + settings.topicsPerPage - 1;

					categoryTools.privileges(req.params.id, uid, function(err, privileges) {
						if (err) {
							return next(err);
						}

						if (!privileges.read) {
							return res.send(403);
						}

						categories.getCategoryById(req.params.id, start, end, uid, function (err, data) {
							if(err) {
								return next(err);
							}

							data.currentPage = page;
							data.privileges = privileges;

							if (data && !data.disabled) {
								res.json(data);
							} else {
								next();
							}
						});
					});
				});
			});

			app.get('/notifications', function(req, res) {
				if (req.user && req.user.uid) {
					user.notifications.getAll(req.user.uid, null, null, function(err, notifications) {
						res.json({
							notifications: notifications
						});
					});
				} else {
					res.send(403);
				}
			});			

			app.get('/search', function (req, res) {
				if ((req.user && req.user.uid) || meta.config.allowGuestSearching === '1') {
					return res.json({
						show_no_topics: 'hide',
						show_no_posts: 'hide',
						show_results: 'hide',
						search_query: '',
						posts: [],
						topics: []
					});
				} else {
					res.send(403);
				}
			});

			app.get('/search/:term', function (req, res, next) {
				if (!Plugins.hasListeners('filter:search.query')) {
					return res.redirect('/404');
				}

				function searchPosts(callback) {
					Plugins.fireHook('filter:search.query', {
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
					Plugins.fireHook('filter:search.query', {
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
				}, next)
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

			app.get('/reset', function (req, res) {
				res.json({});
			});

			app.get('/reset/:code', function (req, res) {
				res.json({
					reset_code: req.params.code
				});
			});

			app.namespace('/categories', function() {
				app.get(':cid/moderators', function(req, res) {
					categories.getModerators(req.params.cid, function(err, moderators) {
						res.json({moderators: moderators});
					})
				});
			});
		});
	}
}(exports));
