var topics = require('./topics'),
	categories = require('./categories');



Controllers = {
	topics: topics,
	categories: categories
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
			function canSee(category, next) {
				CategoryTools.privileges(category.cid, ((req.user) ? req.user.uid || 0 : 0), function(err, privileges) {
					next(!err && privileges.read);
				});
			}

			categories.getAllCategories(0, function (err, returnData) {
				returnData.categories = returnData.categories.filter(function (category) {
					return !category.disabled;
				});

				async.filter(returnData.categories, canSee, function(visibleCategories) {
					returnData.categories = visibleCategories;
					next(null, returnData);
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