var user = require('./../user.js'),
	auth = require('./authentication.js'),
	topics = require('./../topics.js'),
	categories = require('./../categories.js')
	utils = require('./../../public/src/utils.js'),
	pkg = require('../../package.json'),
	meta = require('./../meta.js'),
	path = require('path');


(function(Api) {
	Api.create_routes = function(app) {
		app.get('/api/get_templates_listing', function(req, res) {
			utils.walk(path.join(__dirname, '../../', 'public/templates'), function(err, data) {
				res.json(data);
			});
		});

		app.get('/api/config', function(req, res, next) {
			var config = require('../../public/config.json');

			config['postDelay'] = meta.config['postDelay'];
			config['minimumTitleLength'] = meta.config['minimumTitleLength'];
			config['minimumPostLength'] = meta.config['minimumPostLength'];
			config['imgurClientIDSet'] = !! meta.config['imgurClientID'];
			config['minimumUsernameLength'] = meta.config['minimumUsernameLength'];
			config['maximumUsernameLength'] = meta.config['maximumUsernameLength'];
			config['minimumPasswordLength'] = meta.config['minimumPasswordLength'];

			res.json(200, config);
		});

		app.get('/api/home', function(req, res) {
			var uid = (req.user) ? req.user.uid : 0;
			categories.getAllCategories(function(data) {
				data.categories = data.categories.filter(function(category) {
					return (!category.disabled || category.disabled === "0");
				});

				function iterator(category, callback) {
					categories.getRecentReplies(category.cid, 2, function(posts) {
						category["posts"] = posts;
						category["post_count"] = posts.length > 2 ? 2 : posts.length;
						callback(null);
					});
				}

				require('async').each(data.categories, iterator, function(err) {
					data.motd_class = (meta.config.show_motd === '1' || meta.config.show_motd === undefined) ? '' : 'none';
					data.motd = require('marked')(meta.config.motd || "# NodeBB <span>v " + pkg.version + "</span>\nWelcome to NodeBB, the discussion platform of the future.\n\n<div class='btn-group'><a target=\"_blank\" href=\"http://www.nodebb.org\" class=\"btn btn-default btn-lg\"><i class=\"icon-comment\"></i><span class='hidden-mobile'>&nbsp;Get NodeBB</span></a> <a target=\"_blank\" href=\"https://github.com/designcreateplay/NodeBB\" class=\"btn btn-default btn-lg\"><i class=\"icon-github-alt\"></i><span class='hidden-mobile'>&nbsp;Fork us on Github</span></a> <a target=\"_blank\" href=\"https://twitter.com/dcplabs\" class=\"btn btn-default btn-lg\"><i class=\"icon-twitter\"></i><span class='hidden-mobile'>&nbsp;@dcplabs</span></a></div>");
					res.json(data);
				});

			}, uid);
		});

		app.get('/api/login', function(req, res) {
			var data = {},
				login_strategies = auth.get_login_strategies(),
				num_strategies = login_strategies.length;

			if (num_strategies == 0) {
				data = {
					'login_window:spansize': 'col-md-12',
					'alternate_logins:display': 'none'
				};
			} else {
				data = {
					'login_window:spansize': 'col-md-6',
					'alternate_logins:display': 'block'
				}
				for (var i = 0, ii = num_strategies; i < ii; i++) {
					data[login_strategies[i] + ':display'] = 'active';
				}
			}

			data.token = res.locals.csrf_token;

			res.json(data);
		});

		app.get('/api/register', function(req, res) {
			var data = {},
				login_strategies = auth.get_login_strategies(),
				num_strategies = login_strategies.length;

			if (num_strategies == 0) {
				data = {
					'register_window:spansize': 'col-md-12',
					'alternate_logins:display': 'none'
				};
			} else {
				data = {
					'register_window:spansize': 'col-md-6',
					'alternate_logins:display': 'block'
				}
				for (var i = 0, ii = num_strategies; i < ii; i++) {
					data[login_strategies[i] + ':display'] = 'active';
				}
			}

			data.token = res.locals.csrf_token;
			data.minimumUsernameLength = meta.config['minimumUsernameLength'];
			data.maximumUsernameLength = meta.config['maximumUsernameLength'];
			data.minimumPasswordLength = meta.config['minimumPasswordLength'];
			res.json(data);
		});

		app.get('/api/topic/:id/:slug?', function(req, res, next) {
			var uid = (req.user) ? req.user.uid : 0;
			topics.getTopicWithPosts(req.params.id, uid, 0, 10, function(err, data) {
				if (!err) {
					if (data.deleted === '1' && data.expose_tools === 0) {
						return res.json(404, {});
					}
					res.json(data);
				} else next();
			});
		});

		app.get('/api/category/:id/:slug?', function(req, res, next) {
			var uid = (req.user) ? req.user.uid : 0;
			categories.getCategoryById(req.params.id, uid, function(err, data) {
				if (!err)
					res.json(data);
				else
					next();
			}, req.params.id, uid);
		});

		app.get('/api/recent', function(req, res) {
			var uid = (req.user) ? req.user.uid : 0;
			topics.getLatestTopics(uid, 0, 19, function(data) {
				res.json(data);
			});
		});

		app.get('/api/unread', function(req, res) {
			var uid = (req.user) ? req.user.uid : 0;
			topics.getUnreadTopics(uid, 0, 19, function(data) {
				res.json(data);
			});
		});

		app.get('/api/unread/total', function(req, res) {
			var uid = (req.user) ? req.user.uid : 0;
			topics.getTotalUnread(uid, function(data) {
				res.json(data);
			});
		});

		app.get('/api/confirm/:id', function(req, res) {
			user.email.confirm(req.params.id, function(data) {
				if (data.status === 'ok') {
					res.json({
						'alert-class': 'alert-success',
						title: 'Email Confirmed',
						text: 'Thank you for vaidating your email. Your account is now fully activated.'
					});
				} else {
					res.json({
						'alert-class': 'alert-error',
						title: 'An error occurred...',
						text: 'There was a problem validating your email address. Perhaps the code was invalid or has expired.'
					});
				}
			});
		});

		app.get('/api/outgoing', function(req, res) {
			var url = req.query.url;

			if (url) {
				res.json({
					url: url,
					home: nconf.get('url')
				});
			} else {
				res.status(404);
				res.redirect(nconf.get('relative_path') + '/404');
			}
		});

		app.get('/api/search', function(req, res) {
			return res.json({
				show_no_topics: 'hide',
				show_no_posts: 'hide',
				search_query: '',
				posts: [],
				topics: []
			});
		});

		app.get('/api/search/:term', function(req, res, next) {

			var reds = require('reds');
			var postSearch = reds.createSearch('nodebbpostsearch');
			var topicSearch = reds.createSearch('nodebbtopicsearch');

			function search(searchObj, callback) {
				searchObj
					.query(query = req.params.term).type('or')
					.end(callback);
			}

			function searchPosts(callback) {
				search(postSearch, function(err, pids) {
					if (err)
						return callback(err, null);

					posts.getPostSummaryByPids(pids, function(err, posts) {
						if (err)
							return callback(err, null);
						callback(null, posts);
					});
				})
			}

			function searchTopics(callback) {
				search(topicSearch, function(err, tids) {
					if (err)
						return callback(err, null);

					topics.getTopicsByTids(tids, 0, function(topics) {
						callback(null, topics);
					}, 0);
				});
			}

			async.parallel([searchPosts, searchTopics], function(err, results) {
				if (err)
					return next();

				return res.json({
					show_no_topics: results[1].length ? 'hide' : '',
					show_no_posts: results[0].length ? 'hide' : '',
					search_query: req.params.term,
					posts: results[0],
					topics: results[1]
				});
			});
		});

		app.get('/api/reset', function(req, res) {
			res.json({});
		});

		app.get('/api/reset/:code', function(req, res) {
			res.json({
				reset_code: req.params.code
			});
		});

		app.get('/api/404', function(req, res) {
			res.json({});
		});

		app.get('/api/403', function(req, res) {
			res.json({});
		});
	}
}(exports));
