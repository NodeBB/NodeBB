'use strict';

var social = require('../../social');

var socialController = {};


socialController.get = function(req, res, next) {
	social.getPostSharing(function(err, posts) {
		if (err) {
			return next(err);
		}

		res.render('admin/general/social', {
			posts: posts
		});
	});
};

module.exports = socialController;