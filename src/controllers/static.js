"use strict";

var staticController = {};

createStatic('404');
createStatic('403');
createStatic('500');

function createStatic(statusCode) {
	staticController[statusCode] = function(req, res) {
		if (!res.locals.isAPI) {
			res.statusCode = parseInt(statusCode, 10);
		}

		res.render(statusCode, {});
	};
}

module.exports = staticController;


