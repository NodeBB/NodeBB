var topicsController = require('./topics'),
	categoriesController = require('./categories'),
	async = require('async'),
	categories = require('../categories'),
	categoryTools = require('../categoryTools');



Controllers = {
	topics: topicsController,
	categories: categoriesController
};


Controllers.home = function(req, res, next) {
	async.parallel({
		"header": function (next) {
			/*app.build_header({
				req: req,
				res: res,
				metaTags: [{
					name: "title",
					content: meta.config.title || 'NodeBB'
				}, {
					name: "description",
					content: meta.config.description || ''
				}, {
					property: 'og:title',
					content: 'Index | ' + (meta.config.title || 'NodeBB')
				}, {
					property: "og:type",
					content: 'website'
				}]
			}, next);*/

			next(null);
		},
		"categories": function (next) {
			var uid = (req.user) ? req.user.uid : 0;
			categories.getAllCategories(uid, function (err, data) {
				data.categories = data.categories.filter(function (category) {
					return !category.disabled;
				});

				function canSee(category, next) {
					categoryTools.privileges(category.cid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
						next(!err && privileges.read);
					});
				}

				function getRecentReplies(category, callback) {
					categories.getRecentReplies(category.cid, uid, parseInt(category.numRecentReplies, 10), function (err, posts) {
						category.posts = posts;
						category.post_count = posts.length > 2 ? 2 : posts.length; // this was a hack to make metro work back in the day, post_count should just = length
						callback(null);
					});
				}

				async.filter(data.categories, canSee, function(visibleCategories) {
					data.categories = visibleCategories;

					async.each(data.categories, getRecentReplies, function (err) {
						next(err, data.categories);
					});
				});
			});
		}
	}, function (err, data) {
		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('home', data);
		}
	});
};



module.exports = Controllers;