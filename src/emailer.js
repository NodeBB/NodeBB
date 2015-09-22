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
	tjs = require('templates.js'),

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
		function renderAndTranslate(tpl, params, callback) {
			async.waterfall([
				function(next) {
					render('emails/partials/footer' + (tpl.indexOf('_plaintext') !== -1 ? '_plaintext' : ''), params, next);
				},
				function(footer, next) {
					params.footer = footer;
					render(tpl, params, next);
				},
				function(html, next) {
					translator.translate(html, lang, function(translated) {
						next(null, translated);
					});
				}
			], callback);
		}

		function render(tpl, params, next) {
			if (meta.config['email:custom:' + tpl.replace('emails/', '')]) {
				var text = templates.parse(meta.config['email:custom:' + tpl.replace('emails/', '')], params);
				next(null, text);
			} else {
				app.render(tpl, params, next);
			}
		}

		callback = callback || function() {};

		if (!Plugins.hasListeners('filter:email.send')) {
			winston.warn('[emailer] No active email plugin found to send "' + template + '" email');
			return callback();
		}

		var lang = language || meta.config.defaultLang || 'en_GB';

		async.waterfall([
			function (next) {
				async.parallel({
					html: function(next) {
						renderAndTranslate('emails/' + template, params, next);
					},
					plaintext: function(next) {
						renderAndTranslate('emails/' + template + '_plaintext', params, next);
					},
					subject: function(next) {
						translator.translate(params.subject, lang, function(translated) {
							next(null, translated);
						});
					}
				}, next);
			},
			function (results, next) {
				var data = {
					to: email,
					from: meta.config['email:from'] || 'no-reply@localhost.lan',
					from_name: meta.config['email:from_name'] || 'NodeBB',
					subject: results.subject,
					html: results.html,
					plaintext: results.plaintext,
					template: template,
					uid: params.uid,
					pid: params.pid,
					fromUid: params.fromUid
				};
				Plugins.fireHook('filter:email.modify', data, next);
			},
			function (data, next) {
				Plugins.fireHook('filter:email.send', data, next);
			}
		], callback);
	};



}(module.exports));

