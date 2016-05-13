"use strict";

var posts = require('../posts');
var helpers = require('./helpers');

var postsController = {};

postsController.redirectToPost = function(req, res, callback) {
	var pid = parseInt(req.params.pid, 10);
	if (!pid) {
		return callback();
	}

	posts.generatePostPath(pid, req.uid, function(err, path) {
		if (err || !path) {
			return callback(err);
		}

		helpers.redirect(res, path);
	});
};


module.exports = postsController;
