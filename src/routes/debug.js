"use strict";

var express = require('express'),
	user = require('./../user'),
	categories = require('./../categories'),
	topics = require('./../topics'),
	posts = require('./../posts');

module.exports = function(app, middleware, controllers) {
	var router = express.Router();
	app.use('/debug', router);
	router.get('/uid/:uid', function (req, res) {
		if (!req.params.uid) {
			return res.redirect('/404');
		}

		user.getUserData(req.params.uid, function (err, data) {
			if (data) {
				res.send(data);
			} else {
				res.json(404, {
					error: "User doesn't exist!"
				});
			}
		});
	});

	router.get('/cid/:cid', function (req, res) {
		categories.getCategoryData(req.params.cid, function (err, data) {
			if (data) {
				res.send(data);
			} else {
				res.send(404, "Category doesn't exist!");
			}
		});
	});

	router.get('/tid/:tid', function (req, res) {
		topics.getTopicData(req.params.tid, function (err, data) {
			if (data) {
				res.send(data);
			} else {
				res.send(404, "Topic doesn't exist!");
			}
		});
	});

	router.get('/pid/:pid', function (req, res) {
		posts.getPostData(req.params.pid, function (err, data) {
			if (data) {
				res.send(data);
			} else {
				res.send(404, "Post doesn't exist!");
			}
		});
	});

	router.get('/test', function(req, res) {
		//res.redirect('404');
		var notifications = require('../notifications');
		var nconf = require('nconf');

		var username = 'julian';
		var topicTitle = 'testing tags';
		var topicSlug = '1748/testing-tags';
		var postIndex = 1;
		var tid = 1748;
		var fromUid = 2;

		notifications.create({
			bodyShort: '[[notifications:user_posted_to, ' + username + ', ' + topicTitle + ']]',
			bodyLong: 'asdasd khajsdhakhdakj hdkash dakhdakjdhakjs',
			path: nconf.get('relative_path') + '/topic/' + topicSlug + '/' + postIndex,
			uniqueId: 'topic:' + tid,
			tid: tid,
			from: fromUid
		}, function(err, nid) {
			notifications.push(nid, [1]);
			res.json('done');
		});
	});

	router.get('/dailyunread', function(req, res) {
		//var userNotifs = require('./user');
		user.notifications.getDailyUnread(1, function(err, data) {
			if (err) {
				res.json(500, err.message);
			}

			res.json(data);

		});
	})
};
