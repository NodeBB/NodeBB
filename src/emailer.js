"use strict";

var	fs = require('fs'),
	async = require('async'),
	path = require('path'),
	winston = require('winston'),
	templates = require('templates.js'),

	User = require('./user'),
	Plugins = require('./plugins'),
	Meta = require('./meta'),
	translator = require('../public/src/translator'),

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
		},
		email: async.apply(User.getUserField, uid, 'email'),
		settings: async.apply(User.getSettings, uid)
	}, function(err, results) {
		async.map([results.html, results.plaintext, params.subject], function(raw, next) {
			translator.translate(raw, results.settings.language || meta.config.defaultLang || 'en_GB', function(translated) {
				next(undefined, translated);
			});
		}, function(err, translated) {
			if(err) {
				return winston.error(err.message);
			} else if (!results.email) {
				return winston.warn('uid : ' + uid + ' has no email, not sending.');
			}

			Plugins.fireHook('action:email.send', {
				to: results.email,
				from: Meta.config['email:from'] || 'no-reply@localhost.lan',
				subject: translated[2],
				html: translated[0],
				plaintext: translated[1],
				template: template,
				uid: uid
			});
		});
	});
};

module.exports = Emailer;
