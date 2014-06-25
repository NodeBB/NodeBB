"use strict";

var	fs = require('fs'),
	async = require('async'),
	path = require('path'),
	winston = require('winston'),
	templates = require('templates.js'),

	User = require('./user'),
	Plugins = require('./plugins'),
	Meta = require('./meta'),

	app = {},
	Emailer = {};


Emailer.registerApp = function(expressApp) {
	app = expressApp;
	return Emailer;
};

Emailer.send = function(template, uid, params) {
	async.parallel({
		html: function(next) {
			app.render('emails/' + template, params, next);
		},
		plaintext: function(next) {
			app.render('emails/' + template + '_plaintext', params, next);
		}
	}, function(err, results) {
		User.getUserField(uid, 'email', function(err, email) {
			if(err) {
				return winston.error(err.message);
			}

			if(!email) {
				return winston.warn('uid : ' + uid + ' has no email, not sending.');
			}

			Plugins.fireHook('action:email.send', {
				to: email,
				from: Meta.config['email:from'] || 'no-reply@localhost.lan',
				subject: params.subject,
				html: results.html,
				plaintext: results.plaintext,
				template: template,
				uid: uid
			});
		});
	});
};

module.exports = Emailer;
