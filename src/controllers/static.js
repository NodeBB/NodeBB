"use strict";

var staticController = {};

staticController['404'] = function(req, res) {
	renderStatic(404, res);
};

staticController['403'] = function(req, res) {
	renderStatic(403, res);
};

staticController['500'] = function(req, res) {
	renderStatic(500, res);
};

function renderStatic(statusCode, res) {
	if (!res.locals.isAPI) {
		res.statusCode = statusCode;
	}

	res.render(statusCode.toString(), {});
}

module.exports = staticController;