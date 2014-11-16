'use strict';


var helpers = {};

helpers.notFound = function(res) {
	if (res.locals.isAPI) {
		res.status(404).json('not-found');
	} else {
		res.status(404).render('404');
	}
};

helpers.notAllowed = function(req, res) {
	var uid = req.user ? req.user.uid : 0;

	if (uid) {
		if (res.locals.isAPI) {
			res.status(403).json('not-allowed');
		} else {
			res.status(403).render('403');
		}
	} else {
		if (res.locals.isAPI) {
			req.session.returnTo = req.url.replace(/^\/api/, '');
			res.status(401).json('not-authorized');
		} else {
			req.session.returnTo = req.url;
			res.redirect(nconf.get('relative_path') + '/login');
		}
	}
};


module.exports = helpers;