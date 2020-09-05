'use strict';

const winston = require('winston');
const nconf = require('nconf');
const Benchpress = require('benchpressjs');
const nodemailer = require('nodemailer');
const wellKnownServices = require('nodemailer/lib/well-known/services');
const htmlToText = require('html-to-text');
const url = require('url');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const jwt = require('jsonwebtoken');

const User = require('./user');
const Plugins = require('./plugins');
const meta = require('./meta');
const translator = require('./translator');
const pubsub = require('./pubsub');
const file = require('./file');

const Emailer = module.exports;

Emailer.transports = {
	sendmail: nodemailer.createTransport({
		sendmail: true,
		newline: 'unix',
	}),
	smtp: undefined,
};

var app;

const viewsDir = nconf.get('views_dir');

Emailer.getTemplates = async function (config) {
	const emailsPath = path.join(viewsDir, 'emails');
	let emails = await file.walk(emailsPath);
	emails = emails.filter(email => !email.endsWith('.js'));

	const templates = await Promise.all(emails.map(async (email) => {
		const path = email.replace(emailsPath, '').substr(1).replace('.tpl', '');
		const original = await fs.promises.readFile(email, 'utf8');

		return {
			path: path,
			fullpath: email,
			text: config['email:custom:' + path] || original,
			original: original,
			isCustom: !!config['email:custom:' + path],
		};
	}));
	return templates;
};

Emailer.listServices = function () {
	return Object.keys(wellKnownServices);
};

Emailer._defaultPayload = {};

Emailer.setupFallbackTransport = function (config) {
	winston.verbose('[emailer] Setting up SMTP fallback transport');
	// Enable Gmail transport if enabled in ACP
	if (parseInt(config['email:smtpTransport:enabled'], 10) === 1) {
		var smtpOptions = {
			pool: config['email:smtpTransport:pool'],
		};

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
			smtpOptions.service = String(config['email:smtpTransport:service']);
		}

		Emailer.transports.smtp = nodemailer.createTransport(smtpOptions);
		Emailer.fallbackTransport = Emailer.transports.smtp;
	} else {
		Emailer.fallbackTransport = Emailer.transports.sendmail;
	}
};

let prevConfig = meta.config;
function smtpSettingsChanged(config) {
	const settings = [
		'email:smtpTransport:enabled',
		'email:smtpTransport:user',
		'email:smtpTransport:pass',
		'email:smtpTransport:service',
		'email:smtpTransport:port',
		'email:smtpTransport:host',
		'email:smtpTransport:security',
	];

	return settings.some(key => config[key] !== prevConfig[key]);
}

Emailer.registerApp = function (expressApp) {
	app = expressApp;

	var logo = null;
	if (meta.config.hasOwnProperty('brand:emailLogo')) {
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
	buildCustomTemplates(meta.config);

	// Update default payload if new logo is uploaded
	pubsub.on('config:update', function (config) {
		if (config) {
			if (config['brand:emailLogo']) {
				Emailer._defaultPayload.logo.src = config['brand:emailLogo'];
			}
			if (config['brand:emailLogo:height']) {
				Emailer._defaultPayload.logo.height = config['brand:emailLogo:height'];
			}
			if (config['brand:emailLogo:width']) {
				Emailer._defaultPayload.logo.width = config['brand:emailLogo:width'];
			}

			if (smtpSettingsChanged(config)) {
				Emailer.setupFallbackTransport(config);
			}
			buildCustomTemplates(config);

			prevConfig = config;
		}
	});

	return Emailer;
};

Emailer.send = async function (template, uid, params) {
	if (!app) {
		winston.warn('[emailer] App not ready!');
		return;
	}

	// Combined passed-in payload with default values
	params = { ...Emailer._defaultPayload, ...params };

	const [userData, userSettings] = await Promise.all([
		User.getUserFields(uid, ['email', 'username', 'email:confirmed']),
		User.getSettings(uid),
	]);

	if (!userData || !userData.email) {
		winston.warn('uid : ' + uid + ' has no email, not sending.');
		return;
	}

	const allowedTpls = ['verify_email', 'welcome', 'registration_accepted'];
	if (meta.config.requireEmailConfirmation && !userData['email:confirmed'] && !allowedTpls.includes(template)) {
		winston.warn('uid : ' + uid + ' has not confirmed email, not sending "' + template + '" email.');
		return;
	}

	params.uid = uid;
	params.username = userData.username;
	params.rtl = await translator.translate('[[language:dir]]', userSettings.userLang) === 'rtl';
	try {
		await Emailer.sendToEmail(template, userData.email, userSettings.userLang, params);
	} catch (err) {
		winston.error(err.stack);
	}
};

Emailer.sendToEmail = async function (template, email, language, params) {
	const lang = language || meta.config.defaultLang || 'en-GB';
	const unsubscribable = ['digest', 'notification'];

	// Digests and notifications can be one-click unsubbed
	let payload = {
		template: template,
		uid: params.uid,
	};

	if (unsubscribable.includes(template)) {
		if (template === 'notification') {
			payload.type = params.notification.type;
		}
		payload = jwt.sign(payload, nconf.get('secret'), {
			expiresIn: '30d',
		});

		const unsubUrl = [nconf.get('url'), 'email', 'unsubscribe', payload].join('/');
		params.headers = {
			'List-Id': '<' + [template, params.uid, getHostname()].join('.') + '>',
			'List-Unsubscribe': '<' + unsubUrl + '>',
			'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
			...params.headers,
		};
		params.unsubUrl = unsubUrl;
	}

	const result = await Plugins.fireHook('filter:email.params', {
		template: template,
		email: email,
		language: lang,
		params: params,
	});

	template = result.template;
	email = result.email;
	params = result.params;

	const [html, subject] = await Promise.all([
		Emailer.renderAndTranslate(template, params, result.language),
		translator.translate(params.subject, result.language),
	]);

	const data = await Plugins.fireHook('filter:email.modify', {
		_raw: params,
		to: email,
		from: meta.config['email:from'] || 'no-reply@' + getHostname(),
		from_name: meta.config['email:from_name'] || 'NodeBB',
		subject: '[' + meta.config.title + '] ' + _.unescape(subject),
		html: html,
		plaintext: htmlToText.fromString(html, {
			ignoreImage: true,
		}),
		template: template,
		uid: params.uid,
		pid: params.pid,
		fromUid: params.fromUid,
		headers: params.headers,
		rtl: params.rtl,
	});

	try {
		if (Plugins.hasListeners('filter:email.send')) {
			await Plugins.fireHook('filter:email.send', data);
		} else {
			await Emailer.sendViaFallback(data);
		}
	} catch (err) {
		if (err && err.code === 'ENOENT') {
			throw new Error('[[error:sendmail-not-found]]');
		} else {
			throw err;
		}
	}
};

Emailer.sendViaFallback = function (data, callback) {
	// Some minor alterations to the data to conform to nodemailer standard
	data.text = data.plaintext;
	delete data.plaintext;

	// NodeMailer uses a combined "from"
	data.from = data.from_name + '<' + data.from + '>';
	delete data.from_name;

	winston.verbose('[emailer] Sending email to uid ' + data.uid + ' (' + data.to + ')');
	Emailer.fallbackTransport.sendMail(data, function (err) {
		if (err) {
			winston.error(err.stack);
		}
		callback();
	});
};

async function buildCustomTemplates(config) {
	try {
		const [templates, allPaths] = await Promise.all([
			Emailer.getTemplates(config),
			file.walk(viewsDir),
		]);

		// If the new config contains any email override values, re-compile those templates
		const toBuild = Object
			.keys(config)
			.filter(prop => prop.startsWith('email:custom:'))
			.map(key => key.split(':')[2]);

		const templatesToBuild = templates.filter(template => toBuild.includes(template.path));
		const paths = _.fromPairs(allPaths.map(function (p) {
			const relative = path.relative(viewsDir, p).replace(/\\/g, '/');
			return [relative, p];
		}));

		await Promise.all(templatesToBuild.map(async (template) => {
			const source = await meta.templates.processImports(paths, template.path, template.text);
			const compiled = await Benchpress.precompile(source, {
				minify: global.env !== 'development',
			});
			await fs.promises.writeFile(template.fullpath.replace(/\.tpl$/, '.js'), compiled);
		}));

		Benchpress.flush();
		winston.verbose('[emailer] Built custom email templates');
	} catch (err) {
		winston.error('[emailer] Failed to build custom email templates', err.stack);
	}
}

Emailer.renderAndTranslate = async function (template, params, lang) {
	const html = await app.renderAsync('emails/' + template, params);
	return await translator.translate(html, lang);
};

function getHostname() {
	const configUrl = nconf.get('url');
	const parsed = url.parse(configUrl);
	return parsed.hostname;
}

require('./promisify')(Emailer, ['transports']);
