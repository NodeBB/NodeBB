'use strict';

var request = require('request');
var nconf = require('nconf');

var helpers = module.exports;

helpers.loginUser = function (username, password, callback) {
	var jar = request.jar();
	request({
		url: nconf.get('url') + '/api/config',
		json: true,
		jar: jar
	}, function (err, response, body) {
		if (err || response.statusCode !== 200) {
			return callback(err || new Error('[[error:invalid-response]]'));
		}

		request.post(nconf.get('url') + '/login', {
			form: {
				username: username,
				password: password,
			},
			json: true,
			jar: jar,
			headers: {
				'x-csrf-token': body.csrf_token
			}
		}, function (err, response) {
			if (err || response.statusCode !== 200) {
				return callback(err || new Error('[[error:invalid-response]]'));
			}
			callback();
		});
	});
};