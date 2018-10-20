'use strict';

var async = require('async');
var nconf = require('nconf');

var user = require('../user');
var plugins = require('../plugins');
var topics = require('../topics');
var helpers = require('./helpers');

exports.get = function (req, res, callback) {
	async.waterfall([
		function (next) {
			plugins.fireHook('filter:composer.build', {
				req: req,
				res: res,
				next: callback,
				templateData: {},
			}, next);
		},
		function (data) {
			if (data.templateData.disabled) {
				res.render('', {
					title: '[[modules:composer.compose]]',
				});
			} else {
				data.templateData.title = '[[modules:composer.compose]]';
				res.render('compose', data.templateData);
			}
		},
	], callback);
};

exports.post = function (req, res) {
	var body = req.body;
	var data = {
		uid: req.uid,
		req: req,
		timestamp: Date.now(),
		content: body.content,
	};
	req.body.noscript = 'true';

	if (!data.content) {
		return helpers.noScriptErrors(req, res, '[[error:invalid-data]]', 400);
	}

	async.waterfall([
		function (next) {
			if (body.tid) {
				data.tid = body.tid;
				topics.reply(data, next);
			} else if (body.cid) {
				data.cid = body.cid;
				data.title = body.title;
				data.tags = [];
				data.thumb = '';

				topics.post(data, next);
			} else {
				next(new Error('[[error:invalid-data]]'));
			}
		},
		function (result, next) {
			var uid = result.uid ? result.uid : result.topicData.uid;
			user.updateOnlineUsers(uid);
			next(null, result.pid ? '/post/' + result.pid : '/topic/' + result.topicData.slug);
		},
	], function (err, path) {
		if (err) {
			return helpers.noScriptErrors(req, res, err.message, 400);
		}
		res.redirect(nconf.get('relative_path') + path);
	});
};
