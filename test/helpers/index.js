'use strict';

var request = require('request');
var nconf = require('nconf');
var fs = require('fs');

var myXhr = require('../mocks/newXhr');
var utils = require('../../public/src/utils');

var helpers = module.exports;

helpers.loginUser = function (username, password, callback) {
	var jar = request.jar();
	request({
		url: nconf.get('url') + '/api/config',
		json: true,
		jar: jar,
	}, function (err, res, body) {
		if (err || res.statusCode !== 200) {
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
				'x-csrf-token': body.csrf_token,
			},
		}, function (err, res) {
			if (err || res.statusCode !== 200) {
				return callback(err || new Error('[[error:invalid-response]]'));
			}
			helpers.connectSocketIO(res, function (err, io) {
				callback(err, jar, io, body.csrf_token);
			});
		});
	});
};

helpers.connectSocketIO = function (res, callback) {
	myXhr.callbacks.headerCallback = function () {
		this.setDisableHeaderCheck(true);
		var stdOpen = this.open;
		this.open = function () {
			stdOpen.apply(this, arguments);
			this.setRequestHeader('Cookie', res.headers['set-cookie'][0].split(';')[0]);
			this.setRequestHeader('Origin', nconf.get('url'));
		};
	};

	var socketClient = require('socket.io-client');

	var io = socketClient.connect(nconf.get('base_url'), {
		path: nconf.get('relative_path') + '/socket.io',
		forceNew: true,
		multiplex: false,
	});
	io.on('connect', function () {
		callback(null, io);
	});

	io.on('error', function (err) {
		callback(err);
	});
};

helpers.initSocketIO = function (callback) {
	var jar;
	request.get({
		url: nconf.get('url') + '/api/config',
		jar: jar,
		json: true,
	}, function (err, res) {
		if (err) {
			return callback(err);
		}
		helpers.connectSocketIO(res, function (err, io) {
			callback(err, jar, io);
		});
	});
};

helpers.uploadFile = function (uploadEndPoint, filePath, body, jar, csrf_token, callback) {
	var formData = {
		files: [
			fs.createReadStream(filePath),
			fs.createReadStream(filePath), // see https://github.com/request/request/issues/2445
		],
	};
	formData = utils.merge(formData, body);
	request.post({
		url: uploadEndPoint,
		formData: formData,
		json: true,
		jar: jar,
		headers: {
			'x-csrf-token': csrf_token,
		},
	}, function (err, res, body) {
		if (err) {
			return callback(err);
		}
		if (res.statusCode !== 200) {
			console.log(body);
		}
		callback(null, res, body);
	});
};

helpers.registerUser = function (data, callback) {
	var jar = request.jar();
	request({
		url: nconf.get('url') + '/api/config',
		json: true,
		jar: jar,
	}, function (err, response, body) {
		if (err) {
			return callback(err);
		}

		request.post(nconf.get('url') + '/register', {
			form: data,
			json: true,
			jar: jar,
			headers: {
				'x-csrf-token': body.csrf_token,
			},
		}, function (err) {
			callback(err, jar);
		});
	});
};

// http://stackoverflow.com/a/14387791/583363
helpers.copyFile = function (source, target, callback) {
	var cbCalled = false;

	var rd = fs.createReadStream(source);
	rd.on('error', function (err) {
		done(err);
	});
	var wr = fs.createWriteStream(target);
	wr.on('error', function (err) {
		done(err);
	});
	wr.on('close', function () {
		done();
	});
	rd.pipe(wr);

	function done(err) {
		if (!cbCalled) {
			callback(err);
			cbCalled = true;
		}
	}
};
