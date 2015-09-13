"use strict";

var	fs = require('fs'),
	async = require('async'),
	path = require('path'),
	winston = require('winston'),
	templates = require('templates.js'),

	User = require('./user'),
	Plugins = require('./plugins'),
	meta = require('./meta'),
	translator = require('../public/src/modules/translator'),

	app;

(function(Emailer) {
	Emailer.registerApp = function(expressApp) {
		app = expressApp;
		return Emailer;
	};

	Emailer.send = function(template, uid, params, callback) {
		callback = callback || function() {};
		if (!app) {
			winston.warn('[emailer] App not ready!');
			return callback();
		}

		async.waterfall([
			function(next) {
				async.parallel({
					email: async.apply(User.getUserField, uid, 'email'),
					settings: async.apply(User.getSettings, uid)
				}, next);
			},
			function(results, next) {
				if (!results.email) {
					winston.warn('uid : ' + uid + ' has no email, not sending.');
					return next();
				}
				params.uid = uid;
				Emailer.sendToEmail(template, results.email, results.settings.userLang, params, next);
			}
		], callback);
	};

	Emailer.sendToEmail = function(template, email, language, params, callback) {
		callback = callback || function() {};
		async.parallel({
			html: function(next) {
				app.render('emails/' + template, params, next);
			},
			plaintext: function(next) {
				app.render('emails/' + template + '_plaintext', params, next);
			}
		}, function(err, results) {
			if (err) {
				winston.error('[emailer] Error sending digest : ' + err.stack);
				return callback(err);
			}
			async.map([results.html, results.plaintext, params.subject], function(raw, next) {
				translator.translate(raw, language || meta.config.defaultLang || 'en_GB', function(translated) {
					next(undefined, translated);
				});
			}, function(err, translated) {
				if (err) {
					return callback(err);
				}

				if (Plugins.hasListeners('action:email.send')) {
					Plugins.fireHook('action:email.send', {
						to: email,
						from: meta.config['email:from'] || 'no-reply@localhost.lan',
						from_name: meta.config['email:from_name'] || 'NodeBB',
						subject: translated[2],
						html: translated[0],
						plaintext: translated[1],
						template: template,
						uid: params.uid,
						pid: params.pid,
						fromUid: params.fromUid
					});
					callback();
				} else {
					winston.warn('[emailer] No active email plugin found!');
					callback();
				}
			});
		});

	};



}(module.exports));

