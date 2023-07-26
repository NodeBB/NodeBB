'use strict';

const winston = require('winston');
const validator = require('validator');
const slugify = require('../slugify');

const meta = require('../meta');

const helpers = module.exports;

helpers.try = function (middleware) {
	if (middleware && middleware.constructor && middleware.constructor.name === 'AsyncFunction') {
		return async function (req, res, next) {
			try {
				await middleware(req, res, next);
			} catch (err) {
				next(err);
			}
		};
	}
	return function (req, res, next) {
		try {
			middleware(req, res, next);
		} catch (err) {
			next(err);
		}
	};
};

helpers.buildBodyClass = function (req, res, templateData = {}) {
	const clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
	const parts = clean.split('/').slice(0, 3);
	parts.forEach((p, index) => {
		try {
			p = slugify(decodeURIComponent(p));
		} catch (err) {
			winston.error(`Error decoding URI: ${p}`);
			winston.error(err.stack);
			p = '';
		}
		p = validator.escape(String(p));
		parts[index] = index ? `${parts[0]}-${p}` : `page-${p || 'home'}`;
	});
	const { template } = templateData;
	if (template) {
		parts.push(`template-${template.name.split('/').join('-')}`);
	}

	if (template && template.topic) {
		parts.push(`page-topic-category-${templateData.category.cid}`);
		parts.push(`page-topic-category-${slugify(templateData.category.name)}`);
	}

	if (template && template.chats && templateData.roomId) {
		parts.push(`page-user-chats-${templateData.roomId}`);
	}

	if (Array.isArray(templateData.breadcrumbs)) {
		templateData.breadcrumbs.forEach((crumb) => {
			if (crumb && crumb.hasOwnProperty('cid')) {
				parts.push(`parent-category-${crumb.cid}`);
			}
		});
	}

	if (templateData && templateData.bodyClasses) {
		parts.push(...templateData.bodyClasses);
	}

	parts.push(`page-status-${res.statusCode}`);

	parts.push(`theme-${(meta.config['theme:id'] || '').split('-')[2]}`);

	if (req.loggedIn) {
		parts.push('user-loggedin');
	} else {
		parts.push('user-guest');
	}
	return parts.join(' ');
};
