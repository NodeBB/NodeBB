'use strict';

const querystring = require('querystring');

const posts = require('../posts');
const privileges = require('../privileges');
const helpers = require('./helpers');

const postsController = module.exports;

postsController.redirectToPost = async function (req, res, next) {
	const pid = parseInt(req.params.pid, 10);
	if (!pid) {
		return next();
	}

	const [canRead, path] = await Promise.all([
		privileges.posts.can('topics:read', pid, req.uid),
		posts.generatePostPath(pid, req.uid),
	]);
	if (!path) {
		return next();
	}
	if (!canRead) {
		return helpers.notAllowed(req, res);
	}

	const qs = querystring.stringify(req.query);
	helpers.redirect(res, qs ? path + '?' + qs : path);
};

postsController.getRecentPosts = async function (req, res) {
	const data = await posts.getRecentPosts(req.uid, 0, 19, req.params.term);
	res.json(data);
};
