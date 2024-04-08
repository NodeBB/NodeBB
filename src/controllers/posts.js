'use strict';

const nconf = require('nconf');
const querystring = require('querystring');

const meta = require('../meta');
const posts = require('../posts');
const privileges = require('../privileges');
const utils = require('../utils');

const helpers = require('./helpers');

const postsController = module.exports;

postsController.redirectToPost = async function (req, res, next) {
	const pid = utils.isNumber(req.params.pid) ? parseInt(req.params.pid, 10) : req.params.pid;
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

	if (meta.config.activitypubEnabled) {
		// Include link header for richer parsing
		res.set('Link', `<${nconf.get('url')}/post/${req.params.pid}>; rel="alternate"; type="application/activity+json"`);
	}

	const qs = querystring.stringify(req.query);
	helpers.redirect(res, qs ? `${path}?${qs}` : path, true);
};

postsController.getRecentPosts = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;
	const start = Math.max(0, (page - 1) * postsPerPage);
	const stop = start + postsPerPage - 1;
	const data = await posts.getRecentPosts(req.uid, start, stop, req.params.term);
	res.json(data);
};
