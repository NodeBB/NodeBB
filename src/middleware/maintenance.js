'use strict';

var nconf = require('nconf');
var meta = require('../meta');
var user = require('../user');
var translator = require('../../public/src/modules/translator');


module.exports = function(middleware) {

	middleware.maintenanceMode = function(req, res, next) {
		if (parseInt(meta.config.maintenanceMode, 10) !== 1) {
			return next();
		}
		var url = req.url.replace(nconf.get('relative_path'), '');

		var allowedRoutes = [
				'^/login',
				'^/stylesheet.css',
				'^/favicon',
				'^/nodebb.min.js',
				'^/vendor/fontawesome/fonts/fontawesome-webfont.woff',
				'^/src/(modules|client)/[\\w/]+.js',
				'^/templates/[\\w/]+.tpl',
				'^/api/login',
				'^/api/widgets/render',
				'^/language/.+',
				'^/uploads/system/site-logo.png'
			],
			render = function() {
				res.status(503);
				var data = {
					site_title: meta.config.title || 'NodeBB',
					message: meta.config.maintenanceModeMessage
				};
				if (!isApiRoute.test(url)) {
					middleware.buildHeader(req, res, function() {
						res.render('503', data);
					});
				} else {
					res.json(data);
				}
			},
			isAllowed = function(url) {
				for(var x=0,numAllowed=allowedRoutes.length,route;x<numAllowed;x++) {
					route = new RegExp(allowedRoutes[x]);
					if (route.test(url)) {
						return true;
					}
				}
				return false;
			},
			isApiRoute = /^\/api/;

		if (isAllowed(url)) {
			return next();
		}

		if (!req.user) {
			return render();
		}

		user.isAdministrator(req.user.uid, function(err, isAdmin) {
			if (err) {
				return next(err);
			}
			if (!isAdmin) {
				render();
			} else {
				next();
			}
		});
	};

};