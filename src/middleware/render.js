'use strict';

var nconf = require('nconf');
var translator = require('../../public/src/modules/translator');

module.exports = function(middleware) {

	middleware.processRender = function(req, res, next) {
		// res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
		var render = res.render;
		res.render = function(template, options, fn) {
			var self = this,
				req = this.req,
				defaultFn = function(err, str){
					if (err) {
						return req.next(err);
					}

					self.send(str);
				};
			options = options || {};

			if ('function' === typeof options) {
				fn = options;
				options = {};
			}

			options.loggedIn = req.user ? parseInt(req.user.uid, 10) !== 0 : false;
			options.relative_path = nconf.get('relative_path');
			options.template = {name: template};
			options.template[template] = true;
			options.bodyClass = buildBodyClass(req);

			res.locals.template = template;
			options._locals = undefined;

			if (res.locals.isAPI) {
				if (req.route && req.route.path === '/api/') {
					options.title = '[[pages:home]]';
				}

				return res.json(options);
			}

			if ('function' !== typeof fn) {
				fn = defaultFn;
			}

			var ajaxifyData = JSON.stringify(options);

			render.call(self, template, options, function(err, str) {
				if (err) {
					return fn(err);
				}

				ajaxifyData = ajaxifyData.replace(/<\//g, '<\\/');

				str = str + '<script id="ajaxify-data" type="application/json">' + ajaxifyData + '</script>';

				str = (res.locals.postHeader ? res.locals.postHeader : '') + str + (res.locals.preFooter ? res.locals.preFooter : '');

				if (res.locals.footer) {
					str = str + res.locals.footer;
				} else if (res.locals.adminFooter) {
					str = str + res.locals.adminFooter;
				}

				if (res.locals.renderHeader || res.locals.renderAdminHeader) {
					var method = res.locals.renderHeader ? middleware.renderHeader : middleware.admin.renderHeader;
					method(req, res, options, function(err, template) {
						if (err) {
							return fn(err);
						}
						str = template + str;
						var language = res.locals.config ? res.locals.config.userLang || 'en_GB' : 'en_GB';
						language = req.query.lang || language;
						translator.translate(str, language, function(translated) {
							fn(err, translated);
						});
					});
				} else {
					fn(err, str);
				}
			});
		};

		next();
	};

	function buildBodyClass(req) {
		var clean = req.path.replace(/^\/api/, '').replace(/^\//, '');
		var parts = clean.split('/').slice(0, 3);
		parts.forEach(function(p, index) {
			parts[index] = index ? parts[0] + '-' + p : 'page-' + (p || 'home');
		});
		return parts.join(' ');
	}

};