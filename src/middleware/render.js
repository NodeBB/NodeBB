'use strict';

const nconf = require('nconf');
const validator = require('validator');
const winston = require('winston');

const plugins = require('../plugins');
const meta = require('../meta');
const translator = require('../translator');
const widgets = require('../widgets');
const utils = require('../utils');
const slugify = require('../slugify');
const cacheCreate = require('../cacheCreate');
const cache = cacheCreate({
	name: 'header-footer',
	max: 1000,
	maxAge: 0,
	enabled: global.env === 'production',
});

const relative_path = nconf.get('relative_path');

module.exports = function (middleware) {
	middleware.headerFooterCache = cache;

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
			options.relative_path = relative_path;
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

			const results = await utils.promiseParallel({
				header: renderHeaderFooter('renderHeader', req, res, options),
				content: renderContent(render, templateToRender, req, res, options),
				footer: renderHeaderFooter('renderFooter', req, res, options),
			});

			const str = results.header +
				(res.locals.postHeader || '') +
				results.content +
				'<script id="ajaxify-data" type="application/json">' +
					JSON.stringify(options).replace(/<\//g, '<\\/') +
				'</script>' +
				(res.locals.preFooter || '') +
				results.footer;

			if (typeof fn !== 'function') {
				self.send(str);
			} else {
				fn(null, str);
			}
		};

		next();
	};

	async function renderContent(render, tpl, req, res, options) {
		return new Promise(function (resolve, reject) {
			render.call(res, tpl, options, async function (err, str) {
				if (err) reject(err);
				else resolve(await translate(str, getLang(req, res)));
			});
		});
	}

	async function renderHeaderFooter(method, req, res, options) {
		let str = '';
		const lang = getLang(req, res);
		function getCacheKey() {
			return [lang, method]
				.concat(req.path.split('/').slice(0, 4))
				.join('/');
		}
		let cacheKey;
		if (req.uid === 0 && res.locals.renderHeader) {
			cacheKey = getCacheKey();
			str = cache.get(cacheKey);
			if (str) {
				return str;
			}
		}
		if (!str) {
			if (res.locals.renderHeader) {
				str = await middleware[method](req, res, options);
			} else if (res.locals.renderAdminHeader) {
				str = await middleware.admin[method](req, res, options);
			} else {
				str = '';
			}
		}
		const translated = await translate(str, lang);
		if (req.uid === 0 && res.locals.renderHeader) {
			cache.set(cacheKey, translated, 300000);
		}
		return translated;
	}

	function getLang(req, res) {
		let language = (res.locals.config && res.locals.config.userLang) || 'en-GB';
		if (res.locals.renderAdminHeader) {
			language = (res.locals.config && res.locals.config.acpLang) || 'en-GB';
		}
		return req.query.lang ? validator.escape(String(req.query.lang)) : language;
	}

	async function translate(str, language) {
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
