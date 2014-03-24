"use strict";

var staticController = {};

staticController['404'] = function(req, res, next) {
	res.status(404).render('404', {});
};

staticController['403'] = function(req, res, next) {
	res.status(403).render('403', {});
};

staticController['500'] = function(req, res, next) {
	res.status(500).render('500', {});
};

module.exports = staticController;