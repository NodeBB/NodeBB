'use strict';

var async = require('async');

var social = require('../../social');

var socialController = module.exports;

socialController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			social.getPostSharing(next);
		},
		function (posts) {
			res.render('admin/general/social', {
				posts: posts,
			});
		},
	], next);
};
