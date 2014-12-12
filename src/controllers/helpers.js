'use strict';

var nconf = require('nconf');

var helpers = {};

helpers.notFound = function(req, res, error) {
	if (res.locals.isAPI) {
		res.status(404).json({path: req.path.replace(/^\/api/, ''), error: error});
	} else {
		res.status(404).render('404', {path: req.path, error: error});
	}
};

helpers.notAllowed = function(req, res, error) {
	var uid = req.user ? req.user.uid : 0;

	if (uid) {
		if (res.locals.isAPI) {
			res.status(403).json({path: req.path.replace(/^\/api/, ''), loggedIn: !!uid, error: error});
		} else {
			res.status(403).render('403', {path: req.path, loggedIn: !!uid, error: error});
		}
	} else {
		if (res.locals.isAPI) {
			req.session.returnTo = nconf.get('relative_path') + req.url.replace(/^\/api/, '');
			res.status(401).json('not-authorized');
		} else {
			req.session.returnTo = nconf.get('relative_path') + req.url;
			res.redirect(nconf.get('relative_path') + '/login');
		}
	}
};


module.exports = helpers;