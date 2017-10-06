'use strict';

var async = require('async');
var winston = require('winston');
var nconf = require('nconf');
var Benchpress = require('benchpressjs');
var nodemailer = require('nodemailer');
var wellKnownServices = require('nodemailer/lib/well-known/services');
var htmlToText = require('html-to-text');
var url = require('url');

var User = require('./user');
var Plugins = require('./plugins');
var meta = require('./meta');
var translator = require('./translator');
var pubsub = require('./pubsub');

var transports = {
	sendmail: nodemailer.createTransport({
		sendmail: true,
		newline: 'unix',
	}),
	smtp: undefined,
	// gmail: undefined,
};

var app;
var fallbackTransport;

var Emailer = module.exports;

Emailer.listServices = function (callback) {
	var services = Object.keys(wellKnownServices);
	setImmediate(callback, null, services);
};

Emailer._defaultPayload = {};

Emailer.setupFallbackTransport = function (config) {
	winston.verbose('[emailer] Setting up SMTP fallback transport');
	// Enable Gmail transport if enabled in ACP
	if (parseInt(config['email:smtpTransport:enabled'], 10) === 1) {
		var smtpOptions = {};

		if (config['email:smtpTransport:user'] || config['email:smtpTransport:pass']) {
			smtpOptions.auth = {
				user: config['email:smtpTransport:user'],
				pass: config['email:smtpTransport:pass'],
			};
		}

		if (config['email:smtpTransport:service'] === 'nodebb-custom-smtp') {
			smtpOptions.port = config['email:smtpTransport:port'];
			smtpOptions.host = config['email:smtpTransport:host'];

			if (config['email:smtpTransport:security'] === 'NONE') {
				smtpOptions.secure = false;
				smtpOptions.requireTLS = false;
				smtpOptions.ignoreTLS = true;
			} else if (config['email:smtpTransport:security'] === 'STARTTLS') {
				smtpOptions.secure = false;
				smtpOptions.requireTLS = true;
				smtpOptions.ignoreTLS = false;
			} else {
				// meta.config['email:smtpTransport:security'] === 'ENCRYPTED' or undefined
				smtpOptions.secure = true;
				smtpOptions.requireTLS = true;
				smtpOptions.ignoreTLS = false;
			}
		} else {
			smtpOptions.service = config['email:smtpTransport:service'];
		}

		transports.smtp = nodemailer.createTransport(smtpOptions);
		fallbackTransport = transports.smtp;
	} else {
		fallbackTransport = transports.sendmail;
	}
};

Emailer.registerApp = function (expressApp) {
	app = expressApp;

	var logo = null;
	if (meta.configs.hasOwnProperty('brand:emailLogo')) {
		logo = (!meta.config['brand:emailLogo'].startsWith('http') ? nconf.get('url') : '') + meta.config['brand:emailLogo'];
	}

	Emailer._defaultPayload = {
		url: nconf.get('url'),
		site_title: meta.config.title || 'NodeBB',
		logo: {
			src: logo,
			height: meta.config['brand:emailLogo:height'],
			width: meta.config['brand:emailLogo:width'],
		},
	};

	Emailer.setupFallbackTransport(meta.config);

	// Update default payload if new logo is uploaded
	pubsub.on('config:update', function (config) {
		if (config) {
			if ('email:smtpTransport:enabled' in config) {
				Emailer.setupFallbackTransport(config);
			}
			Emailer._defaultPayload.logo.src = config['brand:emailLogo'];
			Emailer._defaultPayload.logo.height = config['brand:emailLogo:height'];
			Emailer._defaultPayload.logo.width = config['brand:emailLogo:width'];
		}
	});

	return Emailer;
};

Emailer.send = function (template, uid, params, callback) {
	callback = callback || function () {};
	if (!app) {
		winston.warn('[emailer] App not ready!');
		return callback();
	}

	// Combined passed-in payload with default values
	params = Object.assign({}, Emailer._defaultPayload, params);

	async.waterfall([
		function (next) {
			async.parallel({
				email: async.apply(User.getUserField, uid, 'email'),
				settings: async.apply(User.getSettings, uid),
			}, next);
		},
		function (results, next) {
			if (!results.email) {
				winston.warn('uid : ' + uid + ' has no email, not sending.');
				return next();
			}
			params.uid = uid;
			Emailer.sendToEmail(template, results.email, results.settings.userLang, params, next);
		},
	], callback);
};

Emailer.sendToEmail = function (template, email, language, params, callback) {
	callback = callback || function () {};

	var lang = language || meta.config.defaultLang || 'en-GB';

	async.waterfall([
		function (next) {
			async.parallel({
				html: function (next) {
					renderAndTranslate('emails/' + template, params, lang, next);
				},
				subject: function (next) {
					translator.translate(params.subject, lang, function (translated) {
						next(null, translated);
					});
				},
			}, next);
		},
		function (results, next) {
			var data = {
				_raw: params,
				to: email,
				from: meta.config['email:from'] || 'no-reply@' + getHostname(),
				from_name: meta.config['email:from_name'] || 'NodeBB',
				subject: results.subject,
				html: results.html,
				plaintext: htmlToText.fromString(results.html, {
					ignoreImage: true,
				}),
				template: template,
				uid: params.uid,
				pid: params.pid,
				fromUid: params.fromUid,
			};
			Plugins.fireHook('filter:email.modify', data, next);
		},
		function (data, next) {
			if (Plugins.hasListeners('filter:email.send')) {
				Plugins.fireHook('filter:email.send', data, next);
			} else {
				Emailer.sendViaFallback(data, next);
			}
		},
	], function (err) {
		if (err && err.code === 'ENOENT') {
			callback(new Error('[[error:sendmail-not-found]]'));
		} else {
			callback(err);
		}
	});
};

Emailer.sendViaFallback = function (data, callback) {
	// Some minor alterations to the data to conform to nodemailer standard
	data.text = data.plaintext;
	delete data.plaintext;

	// NodeMailer uses a combined "from"
	data.from = data.from_name + '<' + data.from + '>';
	delete data.from_name;

	winston.verbose('[emailer] Sending email to uid ' + data.uid + ' (' + data.to + ')');
	fallbackTransport.sendMail(data, function (err) {
		if (err) {
			winston.error(err);
		}
		callback();
	});
};

function render(tpl, params, next) {
	var customTemplate = meta.config['email:custom:' + tpl.replace('emails/', '')];
	if (customTemplate) {
		Benchpress.compileParse(customTemplate, params, next);
	} else {
		app.render(tpl, params, next);
	}
}

function renderAndTranslate(tpl, params, lang, callback) {
	render(tpl, params, function (err, html) {
		translator.translate(html, lang, function (translated) {
			callback(err, translated);
		});
	});
}

function getHostname() {
	var configUrl = nconf.get('url');
	var parsed = url.parse(configUrl);

	return parsed.hostname;
}
