'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');
var winston = require('winston');

var plugins = require('../plugins');
var translator = require('../translator');
var widgets = require('../widgets');
var utils = require('../utils');

module.exports = function (middleware) {
	middleware.processRender = function (req, res, next) {
		// res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
		var render = res.render;
		res.render = function (template, options, fn) {
			var self = this;
			var req = this.req;
			var defaultFn = function (err, str) {
				if (err) {
					return next(err);
				}
				self.send(str);
			};

			options = options || {};
			if (typeof options === 'function') {
				fn = options;
				options = {};
			}
			if (typeof fn !== 'function') {
				fn = defaultFn;
			}

			var ajaxifyData;
			var templateToRender;
			async.waterfall([
				function (next) {
					options.loggedIn = !!req.uid;
					options.relative_path = nconf.get('relative_path');
					options.template = { name: template };
					options.template[template] = true;
					options.url = (req.baseUrl + req.path.replace(/^\/api/, ''));
					options.bodyClass = buildBodyClass(req, res, options);
					plugins.fireHook('filter:' + template + '.build', { req: req, res: res, templateData: options }, next);
				},
				function (data, next) {
					templateToRender = data.templateData.templateToRender || template;
					plugins.fireHook('filter:middleware.render', { req: req, res: res, templateData: data.templateData }, next);
				},
				function (data, next) {
					options = data.templateData;

					widgets.render(req.uid, {
						template: template + '.tpl',
						url: options.url,
						templateData: options,
						req: req,
						res: res,
					}, next);
				},
				function (data, next) {
					options.widgets = data;

					res.locals.template = template;
					options._locals = undefined;

					if (res.locals.isAPI) {
						if (req.route && req.route.path === '/api/') {
							options.title = '[[pages:home]]';
						}
						req.app.set('json spaces', global.env === 'development' || req.query.pretty ? 4 : 0);
						return res.json(options);
					}

					ajaxifyData = JSON.stringify(options).replace(/<\//g, '<\\/');

					async.parallel({
						header: function (next) {
							renderHeaderFooter('renderHeader', req, res, options, next);
						},
						content: function (next) {
							render.call(self, templateToRender, options, next);
						},
						footer: function (next) {
							renderHeaderFooter('renderFooter', req, res, options, next);
						},
					}, next);
				},
				function (results, next) {
					var str = results.header +
						(res.locals.postHeader || '') +
						results.content + '<script id="ajaxify-data"></script>' +
						(res.locals.preFooter || '') +
						results.footer;

					translate(str, req, res, next);
				},
				function (translated, next) {
					translated = translated.replace('<script id="ajaxify-data"></script>', function () {
						return '<script id="ajaxify-data" type="application/json">' + ajaxifyData + '</script>';
					});
					next(null, translated);
				},
			], fn);
		};

		next();
	};

	function renderHeaderFooter(method, req, res, options, next) {
		if (res.locals.renderHeader) {
			middleware[method](req, res, options, next);
		} else if (res.locals.renderAdminHeader) {
			middleware.admin[method](req, res, options, next);
		} else {
			next(null, '');
		}
	}

	function translate(str, req, res, next) {
		var language = (res.locals.config && res.locals.config.userLang) || 'en-GB';
		if (res.locals.renderAdminHeader) {
			language = (res.locals.config && res.locals.config.acpLang) || 'en-GB';
		}
		language = req.query.lang ? validator.escape(String(req.query.lang)) : language;
		translator.translate(str, language, function (translated) {
			next(null, translator.unescape(translated));
		});
	}

	function buildBodyClass(req, res, templateData) {
		var clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
		var parts = clean.split('/').slice(0, 3);
		parts.forEach(function (p, index) {
			try {
				p = utils.slugify(decodeURIComponent(p));
			} catch (err) {
				winston.error(err);
				p = '';
			}
			p = validator.escape(String(p));
			parts[index] = index ? parts[0] + '-' + p : 'page-' + (p || 'home');
		});

		if (templateData.template.topic) {
			parts.push('page-topic-category-' + templateData.category.cid);
			parts.push('page-topic-category-' + utils.slugify(templateData.category.name));
		}

		parts.push('page-status-' + res.statusCode);
		return parts.join(' ');
	}
};
