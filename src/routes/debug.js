'use strict';

var express = require('express');
var nconf = require('nconf');

module.exports = function (app) {
	var router = express.Router();

	router.get('/test', function (req, res) {
		res.redirect(404);
	});

	app.use(nconf.get('relative_path') + '/debug', router);
};
