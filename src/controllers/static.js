"use strict";

var staticController = {};

staticController['404'] = function(req, res, next) {
	if (!res.locals.isAPI) {
		res.statusCode = 404;
	}

	res.render('404', {});
};

staticController['403'] = function(req, res, next) {
	if (!res.locals.isAPI) {
		res.statusCode = 403;
	}

	res.render('403', {});
};

staticController['500'] = function(req, res, next) {
	if (!res.locals.isAPI) {
		res.statusCode = 500;
	}

	res.render('500', {});
};

module.exports = staticController;