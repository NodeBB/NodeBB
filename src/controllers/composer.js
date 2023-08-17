'use strict';

const nconf = require('nconf');

const user = require('../user');
const plugins = require('../plugins');
const topics = require('../topics');
const posts = require('../posts');
const helpers = require('./helpers');

exports.get = async function (req, res, callback) {
	res.locals.metaTags = {
		...res.locals.metaTags,
		name: 'robots',
		content: 'noindex',
	};

	const data = await plugins.hooks.fire('filter:composer.build', {
		req: req,
		res: res,
		next: callback,
		templateData: {},
	});

	if (res.headersSent) {
		return;
	}
	if (!data || !data.templateData) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (data.templateData.disabled) {
		res.render('', {
			title: '[[modules:composer.compose]]',
		});
	} else {
		data.templateData.title = '[[modules:composer.compose]]';
		res.render('compose', data.templateData);
	}
};

exports.post = async function (req, res) {
	const { body } = req;
	const data = {
		uid: req.uid,
		req: req,
		timestamp: Date.now(),
		content: body.content,
		handle: body.handle,
		fromQueue: false,
	};
	req.body.noscript = 'true';

	if (!data.content) {
		return helpers.noScriptErrors(req, res, '[[error:invalid-data]]', 400);
	}
	async function queueOrPost(postFn, data) {
		const shouldQueue = await posts.shouldQueue(req.uid, data);
		if (shouldQueue) {
			delete data.req;
			return await posts.addToQueue(data);
		}
		return await postFn(data);
	}

	try {
		let result;
		if (body.tid) {
			data.tid = body.tid;
			result = await queueOrPost(topics.reply, data);
		} else if (body.cid) {
			data.cid = body.cid;
			data.title = body.title;
			data.tags = [];
			data.thumb = '';
			result = await queueOrPost(topics.post, data);
		} else {
			throw new Error('[[error:invalid-data]]');
		}
		if (!result) {
			throw new Error('[[error:invalid-data]]');
		}
		if (result.queued) {
			return res.redirect(`${nconf.get('relative_path') || '/'}?noScriptMessage=[[success:post-queued]]`);
		}
		user.updateOnlineUsers(req.uid);
		let path = nconf.get('relative_path');
		if (result.pid) {
			path += `/post/${result.pid}`;
		} else if (result.topicData) {
			path += `/topic/${result.topicData.slug}`;
		}
		res.redirect(path);
	} catch (err) {
		helpers.noScriptErrors(req, res, err.message, 400);
	}
};
