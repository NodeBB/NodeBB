var path = require('path'),
	nconf = require('nconf'),
	async = require('async'),

	db = require('../database'),
	user = require('../user'),
	groups = require('../groups'),
	auth = require('./authentication'),
	topics = require('../topics'),
	ThreadTools = require('../threadTools'),
	posts = require('../posts'),
	categories = require('../categories'),
	categoryTools = require('../categoryTools')
	utils = require('../../public/src/utils'),
	translator = require('../../public/src/translator'),
	pkg = require('../../package.json'),
	meta = require('../meta');


(function (Api) {
	Api.createRoutes = function (app) {

		app.namespace('/api', function () {
			app.get('/get_templates_listing', function (req, res) {
				utils.walk(path.join(__dirname, '../../', 'public/templates'), function (err, data) {
					res.json(data);
				});
			});

			app.get('/config', function (req, res, next) {
				var config = require('../../public/config.json');

				config.postDelay = meta.config.postDelay;
				config.minimumTitleLength = meta.config.minimumTitleLength;
				config.maximumTitleLength = meta.config.maximumTitleLength;
				config.minimumPostLength = meta.config.minimumPostLength;
				config.imgurClientIDSet = !! meta.config.imgurClientID;
				config.minimumUsernameLength = meta.config.minimumUsernameLength;
				config.maximumUsernameLength = meta.config.maximumUsernameLength;
				config.minimumPasswordLength = meta.config.minimumPasswordLength;
				config.maximumSignatureLength = meta.config.maximumSignatureLength;
				config.useOutgoingLinksPage = parseInt(meta.config.useOutgoingLinksPage, 10) === 1;
				config.allowGuestPosting = parseInt(meta.config.allowGuestPosting, 10) === 1;
				config.allowFileUploads = parseInt(meta.config.allowFileUploads, 10) === 1;
				config.usePagination = parseInt(meta.config.usePagination, 10) === 1;
				config.topicsPerPage = meta.config.topicsPerPage || 20;
				config.postsPerPage = meta.config.postsPerPage || 20;
				config.maximumFileSize = meta.config.maximumFileSize;
				config.emailSetup = !!meta.config['email:from'];
				config.defaultLang = meta.config.defaultLang || 'en';

				res.json(200, config);
			});

			app.get('/home', function (req, res) {
				var uid = (req.user) ? req.user.uid : 0;
				categories.getAllCategories(uid, function (err, data) {
					// Remove disabled categories
					data.categories = data.categories.filter(function (category) {
						return (!category.disabled || parseInt(category.disabled, 10) === 0);
					});

					// Retrieve category information for /
					function iterator(category, callback) {
						categories.getRecentReplies(category.cid, uid, parseInt(category.numRecentReplies, 10), function (err, posts) {
							category.posts = posts;
							category.post_count = posts.length > 2 ? 2 : posts.length; // this was a hack to make metro work back in the day, post_count should just = length
							callback(null);
						});
					}

					async.each(data.categories, iterator, function (err) {
						// Assemble the MOTD
						var	motdString,
							assemble = function() {
								data.motd_class = (parseInt(meta.config.show_motd, 10) === 1 || meta.config.show_motd === undefined) ? '' : ' none';
								data.motd_class += (meta.config.motd && meta.config.motd.length > 0 ? '' : ' default');
								data.motd_class += meta.config.motd_class ? ' ' + meta.config.motd_class : '';

								data.motd = require('marked')(motdString);
								res.json(data);
							};
						if (!meta.config.motd) {
							// Construct default MOTD
							translator.translate('\n\n# NodeBB <small><span>v' + pkg.version + '</span></small>\n\n<h5>[[global:motd.welcome]]</h5>\
								<div class="btn-group">\
									<a target="_blank" href="https://www.nodebb.org" class="btn btn-link btn-md">\
										<i class="fa fa-comment"></i>\
										<span>&nbsp;[[global:motd.get]]</span>\
									</a>\
									<a target="_blank" href="https://github.com/designcreateplay/NodeBB" class="btn btn-link btn-md">\
										<i class="fa fa-github"></i>\
										<span>&nbsp;[[global:motd.fork]]</span>\
									</a>\
									<a target="_blank" href="https://facebook.com/NodeBB" class="btn btn-link btn-md">\
										<i class="fa fa-facebook"></i>\
										<span>&nbsp;[[global:motd.like]]</span>\
									</a>\
									<a target="_blank" href="https://twitter.com/NodeBB" class="btn btn-link btn-md">\
										<i class="fa fa-twitter"></i>\
										<span>&nbsp;[[global:motd.follow]]</span>\
									</a>\
								</div>\
							', function(motd) {
								motdString = motd;
								assemble();
							});
						} else {
							motdString = meta.config.motd;
							assemble();
						}
					});
				});
			});

			app.get('/login', function (req, res) {
				var data = {},
					login_strategies = auth.get_login_strategies(),
					num_strategies = login_strategies.length;

				if (num_strategies == 0) {
					data = {
						'login_window:spansize': 'col-md-12',
						'alternate_logins': false
					};
				} else {
					data = {
						'login_window:spansize': 'col-md-6',
						'alternate_logins': true
					}
				}

				data.authentication = login_strategies;

				data.token = res.locals.csrf_token;

				res.json(data);
			});

			app.get('/register', function (req, res) {
				var data = {},
					login_strategies = auth.get_login_strategies(),
					num_strategies = login_strategies.length;

				if (num_strategies == 0) {
					data = {
						'register_window:spansize': 'col-md-12',
						'alternate_logins': false
					};
				} else {
					data = {
						'register_window:spansize': 'col-md-6',
						'alternate_logins': true
					}
				}

				data.authentication = login_strategies;

				data.token = res.locals.csrf_token;
				data.minimumUsernameLength = meta.config['minimumUsernameLength'];
				data.maximumUsernameLength = meta.config['maximumUsernameLength'];
				data.minimumPasswordLength = meta.config['minimumPasswordLength'];
				res.json(data);
			});

			app.get('/topic/:id/:slug?', function (req, res, next) {

				var uid = (req.user) ? req.user.uid : 0;
				var page = 1;
				if(req.query && req.query.page) {
					page = req.query.page;
				}

				if(!utils.isNumber(page) || parseInt(page, 10) < 1) {
					return res.send(404);
				}

				var postsPerPage = parseInt(meta.config.postsPerPage ? meta.config.postsPerPage : 20, 10);
				var start = (page - 1) * postsPerPage;
				var end = start + postsPerPage - 1;

				ThreadTools.privileges(req.params.id, uid, function(err, privileges) {
					if (privileges.read) {
						topics.getTopicWithPosts(req.params.id, uid, start, end, false, function (err, data) {
							if(err) {
								return next(err);
							}

							if(page > data.pageCount) {
								return res.send(404);
							}

							data.currentPage = page;
							data.privileges = privileges;

							if (parseInt(data.deleted, 10) === 1 && parseInt(data.expose_tools, 10) === 0) {
								return res.json(404, {});
							}

							res.json(data);
						});
					} else {
						res.send(403);
					}
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

				var topicsPerPage = parseInt(meta.config.topicsPerPage ? meta.config.topicsPerPage : 20, 10);
				var start = (page - 1) * topicsPerPage;
				var end = start + topicsPerPage - 1;

				// Category Whitelisting
				categoryTools.privileges(req.params.id, uid, function(err, privileges) {
					if (!err && privileges.read) {
						categories.getCategoryById(req.params.id, start, end, uid, function (err, data) {
							if(err) {
								return next(err);
							}

							data.currentPage = page;
							data.privileges = privileges;

							if (data && parseInt(data.disabled, 10) === 0) {
								res.json(data);
							} else {
								next();
							}
						}, req.params.id, uid);
					} else {
						res.send(403);
					}
				});
			});

			app.get('/recent/:term?', function (req, res, next) {
				var uid = (req.user) ? req.user.uid : 0;
				topics.getLatestTopics(uid, 0, 19, req.params.term, function (err, data) {
					if(err) {
						return next(err);
					}

					res.json(data);
				});
			});

			app.get('/unread', function (req, res, next) {
				var uid = (req.user) ? req.user.uid : 0;
				topics.getUnreadTopics(uid, 0, 19, function (err, data) {
					if(err) {
						return next(err);
					}

					res.json(data);
				});
			});

			app.get('/unread/total', function (req, res, next) {
				var uid = (req.user) ? req.user.uid : 0;
				topics.getTotalUnread(uid, function (err, data) {
					if(err) {
						return next(err);
					}

					res.json(data);
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

			app.get('/confirm/:id', function (req, res) {
				user.email.confirm(req.params.id, function (data) {
					if (data.status === 'ok') {
						res.json({
							'alert-class': 'alert-success',
							title: 'Email Confirmed',
							text: 'Thank you for vaidating your email. Your account is now fully activated.'
						});
					} else {
						res.json({
							'alert-class': 'alert-danger',
							title: 'An error occurred...',
							text: 'There was a problem validating your email address. Perhaps the code was invalid or has expired.'
						});
					}
				});
			});

			app.get('/outgoing', function (req, res) {
				var url = req.query.url;

				if (url) {
					res.json({
						url: url,
						title: meta.config.title
					});
				} else {
					res.status(404);
					res.redirect(nconf.get('relative_path') + '/404');
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
				var limit = 50;

				function searchPosts(callback) {
					db.search('post', req.params.term, limit, function(err, pids) {
						if (err) {
							return callback(err, null);
						}

						posts.getPostSummaryByPids(pids, false, callback);
					});
				}

				function searchTopics(callback) {
					db.search('topic', req.params.term, limit, function(err, tids) {
						if (err) {
							return callback(err, null);
						}

						topics.getTopicsByTids(tids, 0, 0, callback);
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

			app.get('/reset', function (req, res) {
				res.json({});
			});

			app.get('/reset/:code', function (req, res) {
				res.json({
					reset_code: req.params.code
				});
			});

			app.get('/404', function (req, res) {
				res.json({});
			});

			app.get('/403', function (req, res) {
				res.json({});
			});

			app.get('/500', function(req, res) {
				res.json({errorMessage: 'testing'});
			});
		});
	}
}(exports));
