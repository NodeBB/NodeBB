'use strict';

const util = require('util');
const nconf = require('nconf');
const validator = require('validator');
const winston = require('winston');

const plugins = require('../plugins');
const meta = require('../meta');
const translator = require('../translator');
const widgets = require('../widgets');
const utils = require('../utils');
const slugify = require('../slugify');

module.exports = function (middleware) {
	middleware.processRender = function processRender(req, res, next) {
		// res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
		const render = res.render;
		res.render = async function renderOverride(template, options, fn) {
			const self = this;
			const req = this.req;

			options = options || {};
			if (typeof options === 'function') {
				fn = options;
				options = {};
			}

			options.loggedIn = req.uid > 0;
			options.relative_path = nconf.get('relative_path');
			options.template = { name: template, [template]: true };
			options.url = (req.baseUrl + req.path.replace(/^\/api/, ''));
			options.bodyClass = buildBodyClass(req, res, options);

			const buildResult = await plugins.fireHook('filter:' + template + '.build', { req: req, res: res, templateData: options });
			const templateToRender = buildResult.templateData.templateToRender || template;

			const renderResult = await plugins.fireHook('filter:middleware.render', { req: req, res: res, templateData: buildResult.templateData });
			options = renderResult.templateData;
			options._header = {
				tags: await meta.tags.parse(req, renderResult, res.locals.metaTags, res.locals.linkTags),
			};
			options.widgets = await widgets.render(req.uid, {
				template: template + '.tpl',
				url: options.url,
				templateData: options,
				req: req,
				res: res,
			});
			res.locals.template = template;
			options._locals = undefined;

			if (res.locals.isAPI) {
				if (req.route && req.route.path === '/api/') {
					options.title = '[[pages:home]]';
				}
				req.app.set('json spaces', global.env === 'development' || req.query.pretty ? 4 : 0);
				return res.json(options);
			}
			const ajaxifyData = JSON.stringify(options).replace(/<\//g, '<\\/');

			const renderAsync = util.promisify((templateToRender, options, next) => render.call(self, templateToRender, options, next));

			const results = await utils.promiseParallel({
				header: renderHeaderFooter('renderHeader', req, res, options),
				content: renderAsync(templateToRender, options),
				footer: renderHeaderFooter('renderFooter', req, res, options),
			});

			const str = results.header +
				(res.locals.postHeader || '') +
				results.content + '<script id="ajaxify-data"></script>' +
				(res.locals.preFooter || '') +
				results.footer;

			let translated = await translate(str, req, res);
			translated = translated.replace('<script id="ajaxify-data"></script>', function () {
				return '<script id="ajaxify-data" type="application/json">' + ajaxifyData + '</script>';
			});

			if (typeof fn !== 'function') {
				self.send(translated);
			} else {
				fn(null, translated);
			}
		};

		next();
	};

	async function renderHeaderFooter(method, req, res, options) {
		if (res.locals.renderHeader) {
			return await middleware[method](req, res, options);
		} else if (res.locals.renderAdminHeader) {
			return await middleware.admin[method](req, res, options);
		}
		return '';
	}

	async function translate(str, req, res) {
		let language = (res.locals.config && res.locals.config.userLang) || 'en-GB';
		if (res.locals.renderAdminHeader) {
			language = (res.locals.config && res.locals.config.acpLang) || 'en-GB';
		}
		language = req.query.lang ? validator.escape(String(req.query.lang)) : language;
		const translated = await translator.translate(str, language);
		return translator.unescape(translated);
	}

	function buildBodyClass(req, res, templateData) {
		const clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
		const parts = clean.split('/').slice(0, 3);
		parts.forEach(function (p, index) {
			try {
				p = slugify(decodeURIComponent(p));
			} catch (err) {
				winston.error(err.stack);
				p = '';
			}
			p = validator.escape(String(p));
			parts[index] = index ? parts[0] + '-' + p : 'page-' + (p || 'home');
		});

		if (templateData.template.topic) {
			parts.push('page-topic-category-' + templateData.category.cid);
			parts.push('page-topic-category-' + slugify(templateData.category.name));
		}
		if (templateData.breadcrumbs) {
			templateData.breadcrumbs.forEach(function (crumb) {
				if (crumb.hasOwnProperty('cid')) {
					parts.push('parent-category-' + crumb.cid);
				}
			});
		}

		parts.push('page-status-' + res.statusCode);
		return parts.join(' ');
	}
};
