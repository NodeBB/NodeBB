"use strict";

var staticController = {};

staticController['404'] = function(req, res) {
	renderStatic(404, req, res);
};

staticController['403'] = function(req, res) {
	renderStatic(403, req, res);
};

staticController['500'] = function(req, res) {
	renderStatic(500, req, res);
};

function renderStatic(statusCode, req, res) {
	if (!res.locals.isAPI) {
		res.statusCode = statusCode;
	}

	res.render(statusCode.toString(), {});
}

module.exports = staticController;