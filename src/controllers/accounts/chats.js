'use strict';

var async = require('async'),
	nconf = require('nconf'),

	user = require('../../user'),
	messaging = require('../../messaging'),
	meta = require('../../meta'),
	helpers = require('../helpers'),
	utils = require('../../../public/src/utils');

var chatsController = {};

chatsController.get = function(req, res, callback) {
	if (parseInt(meta.config.disableChat, 10) === 1) {
		return callback();
	}

	// In case a userNAME is passed in instead of a slug, the route should not 404
	var slugified = utils.slugify(req.params.userslug);
	if (req.params.userslug && req.params.userslug !== slugified) {
		return helpers.redirect(res, '/chats/' + slugified);
	}

	async.parallel({
		contacts: async.apply(user.getFollowing, req.user.uid, 0, 199),
		recentChats: async.apply(messaging.getRecentChats, req.user.uid, 0, 19)
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		if (results.recentChats.users && results.recentChats.users.length) {
			var contactUids = results.recentChats.users.map(function(chatObj) {
					return parseInt(chatObj.uid, 10);
				});

			results.contacts = results.contacts.filter(function(contact) {
				return contactUids.indexOf(parseInt(contact.uid, 10)) === -1;
			});
		}

		if (!req.params.userslug) {
			return res.render('chats', {
				chats: results.recentChats.users,
				nextStart: results.recentChats.nextStart,
				contacts: results.contacts,
				allowed: true,
				title: '[[pages:chats]]',
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:chats]]'}])
			});
		}

		async.waterfall([
			async.apply(user.getUidByUserslug, req.params.userslug),
			function(toUid, next) {
				if (!toUid || parseInt(toUid, 10) === parseInt(req.user.uid, 10)) {
					return callback();
				}

				async.parallel({
					toUser: async.apply(user.getUserFields, toUid, ['uid', 'username']),
					messages: async.apply(messaging.getMessages, {
						fromuid: req.user.uid,
						touid: toUid,
						since: 'recent',
						isNew: false
					}),
					allowed: async.apply(messaging.canMessage, req.user.uid, toUid)
				}, next);
			}
		], function(err, data) {
			if (err) {
				return callback(err);
			}

			res.render('chats', {
				chats: results.recentChats.users,
				nextStart: results.recentChats.nextStart,
				contacts: results.contacts,
				meta: data.toUser,
				messages: data.messages,
				allowed: data.allowed,
				title: '[[pages:chat, ' + data.toUser.username + ']]',
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:chats]]', url: '/chats'}, {text: data.toUser.username}])
			});
		});
	});
};

module.exports = chatsController;