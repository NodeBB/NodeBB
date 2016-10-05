'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var plugins = require('../plugins');
var translator = require('../../public/src/modules/translator');

module.exports = function(middleware) {

	middleware.processRender = function(req, res, next) {
		// res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
		var render = res.render;
		res.render = function(template, options, fn) {
			var self = this;
			var req = this.req;
			var defaultFn = function(err, str) {
				if (err) {
					return next(err);
				}
				self.send(str);
			};

			options = options || {};
			if ('function' === typeof options) {
				fn = options;
				options = {};
			}
			if ('function' !== typeof fn) {
				fn = defaultFn;
			}

			var ajaxifyData;
			async.waterfall([
				function(next) {
					plugins.fireHook('filter:' + template + '.build', {req: req, res: res, templateData: options}, next);
				},
				function(data, next) {
					options = data.templateData;

					options.loggedIn = !!req.uid;
					options.relative_path = nconf.get('relative_path');
					options.template = {name: template};
					options.template[template] = true;
					options.url = (req.baseUrl + req.path).replace(/^\/api/, '');
					options.bodyClass = buildBodyClass(req);

					res.locals.template = template;
					options._locals = undefined;

					if (res.locals.isAPI) {
						if (req.route && req.route.path === '/api/') {
							options.title = '[[pages:home]]';
						}

						return res.json(options);
					}

					ajaxifyData = JSON.stringify(options).replace(/<\//g, '<\\/');

					async.parallel({
						header: function(next) {
							renderHeaderFooter('renderHeader', req, res, options, next);
						},
						content: function(next) {
							render.call(self, template, options, next);
						},
						footer: function(next) {
							renderHeaderFooter('renderFooter', req, res, options, next);
						}
					}, next);
				},
				function(results, next) {
					var str = results.header +
						(res.locals.postHeader || '') +
						results.content +
						(res.locals.preFooter || '') +
						results.footer;

					translate(str, req, res, next);
				},
				function(translated, next) {
					next(null, translated + '<script id="ajaxify-data" type="application/json">' + ajaxifyData + '</script>');
				}
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
		var language = res.locals.config ? res.locals.config.userLang || 'en_GB' : 'en_GB';
		language = req.query.lang ? validator.escape(String(req.query.lang)) : language;
		translator.translate(str, language, function(translated) {
			next(null, translator.unescape(translated));
		});
	}

	function buildBodyClass(req) {
		var clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
		var parts = clean.split('/').slice(0, 3);
		parts.forEach(function(p, index) {
			parts[index] = index ? parts[0] + '-' + p : 'page-' + (p || 'home');
		});
		return parts.join(' ');
	}

};
