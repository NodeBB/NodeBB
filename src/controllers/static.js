"use strict";

var staticController = {},
	isApi = function(path) {
		return !!path.match('api');
	};

staticController['404'] = function(req, res, next) {
	if (!isApi(req.path)) {
		res.statusCode = 404;
	}

	res.render('404', {});
};

staticController['403'] = function(req, res, next) {
	if (!isApi(req.path)) {
		res.statusCode = 403;
	}

	res.render('403', {});
};

staticController['500'] = function(req, res, next) {
	if (!isApi(req.path)) {
		res.statusCode = 500;
	}

	res.render('500', {});
};

module.exports = staticController;