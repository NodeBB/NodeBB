"use strict";

var	async = require('async'),
	winston = require('winston'),
	templates = require('templates.js'),
	nodemailer = require('nodemailer'),
	htmlToText = require('html-to-text'),

	User = require('./user'),
	Plugins = require('./plugins'),
	meta = require('./meta'),
	translator = require('../public/src/modules/translator'),

	transports = {
		direct: nodemailer.createTransport('direct')
	},
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

		var lang = language || meta.config.defaultLang || 'en_GB';

		async.waterfall([
			function (next) {
				async.parallel({
					html: function(next) {
						renderAndTranslate('emails/' + template, params, lang, next);
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
					plaintext: htmlToText.fromString(results.html, {
						ignoreImage: true
					}),
					template: template,
					uid: params.uid,
					pid: params.pid,
					fromUid: params.fromUid
				};
				Plugins.fireHook('filter:email.modify', data, next);
			},
			function (data, next) {
				if (Plugins.hasListeners('filter:email.send')) {
					Plugins.fireHook('filter:email.send', data, next);
				} else {
					Emailer.sendViaFallback(data, next);
				}
			}
		], function (err) {
			callback(err);
		});
	};

	Emailer.sendViaFallback = function(data, callback) {
		// Some minor alterations to the data to conform to nodemailer standard
		data.text = data.plaintext;
		delete data.plaintext;

		transports.direct.sendMail(data, callback);
	};

	function render(tpl, params, next) {
		if (meta.config['email:custom:' + tpl.replace('emails/', '')]) {
			var text = templates.parse(meta.config['email:custom:' + tpl.replace('emails/', '')], params);
			next(null, text);
		} else {
			app.render(tpl, params, next);
		}
	}

	function renderAndTranslate(tpl, params, lang, callback) {
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

}(module.exports));

