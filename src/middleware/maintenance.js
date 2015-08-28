'use strict';

var meta = require('../meta');
var user = require('../user');
var translator = require('../../public/src/modules/translator');


module.exports = function(middleware) {

	middleware.maintenanceMode = function(req, res, next) {
		console.log(req.path, meta.config.maintenanceMode)
		if (parseInt(meta.config.maintenanceMode, 10) !== 1) {
			return next();
		}

		var allowedRoutes = [
				'/login',
				'/stylesheet.css',
				'/nodebb.min.js',
				'/vendor/fontawesome/fonts/fontawesome-webfont.woff',
				'/src/(modules|client)/[\\w/]+.js',
				'/templates/[\\w/]+.tpl',
				'/api/login',
				'/api/?',
				'/language/.+',
				'/uploads/system/site-logo.png'
			],
			render = function() {
				res.status(503);

				if (!isApiRoute.test(req.url)) {
					middleware.buildHeader(req, res, function() {
						res.render('maintenance', {
							site_title: meta.config.title || 'NodeBB',
							message: meta.config.maintenanceModeMessage
						});
					});
				} else {
					translator.translate('[[pages:maintenance.text, ' + meta.config.title + ']]', meta.config.defaultLang || 'en_GB', function(translated) {
						res.json({
							error: translated
						});
					});
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

		if (isAllowed(req.url)) {
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