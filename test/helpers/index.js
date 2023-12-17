'use strict';

const nconf = require('nconf');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const request = require('../../src/request');

const helpers = module.exports;

helpers.getCsrfToken = async (jar) => {
	const { body } = await request.get(`${nconf.get('url')}/api/config`, {
		jar,
	});
	return body.csrf_token;
};

helpers.request = async function (method, uri, options = {}) {
	const ignoreMethods = ['GET', 'HEAD', 'OPTIONS'];
	const lowercaseMethod = String(method).toLowerCase();
	let csrf_token;
	if (!ignoreMethods.some(method => method.toLowerCase() === lowercaseMethod)) {
		csrf_token = await helpers.getCsrfToken(options.jar);
	}

	options.headers = options.headers || {};
	if (csrf_token) {
		options.headers['x-csrf-token'] = csrf_token;
	}
	options.validateStatus = null;
	const { response, body } = await request[lowercaseMethod](`${nconf.get('url')}${uri}`, options);
	return { response, body };
};

helpers.loginUser = async (username, password, payload = {}) => {
	const jar = request.jar();
	const data = { username, password, ...payload };

	const csrf_token = await helpers.getCsrfToken(jar);
	const { response, body } = await request.post(`${nconf.get('url')}/login`, {
		data,
		jar: jar,
		validateStatus: () => true,
		headers: {
			'x-csrf-token': csrf_token,
		},
	});

	return { jar, response, body, csrf_token };
};

helpers.logoutUser = async function (jar) {
	const csrf_token = await helpers.getCsrfToken(jar);
	const { response, body } = await request.post(`${nconf.get('url')}/logout`, {
		data: {},
		jar,
		validateStatus: () => true,
		headers: {
			'x-csrf-token': csrf_token,
		},
	});
	return { response, body };
};

helpers.connectSocketIO = function (res, csrf_token) {
	const io = require('socket.io-client');
	let cookies = res.headers['set-cookie'];
	cookies = cookies.filter(c => /express.sid=[^;]+;/.test(c));
	const cookie = cookies[0];
	const socket = io(nconf.get('base_url'), {
		path: `${nconf.get('relative_path')}/socket.io`,
		extraHeaders: {
			Origin: nconf.get('url'),
			Cookie: cookie,
		},
		query: {
			_csrf: csrf_token,
		},
	});
	return new Promise((resolve, reject) => {
		let error;
		socket.on('connect', () => {
			if (error) {
				return;
			}
			resolve(socket);
		});

		socket.on('error', (err) => {
			error = err;
			console.log('socket.io error', err.stack);
			reject(err);
		});
	});
};

helpers.uploadFile = async function (uploadEndPoint, filePath, data, jar, csrf_token) {
	const FormData = require('form-data');
	const form = new FormData();
	form.append('files', fs.createReadStream(filePath), path.basename(filePath));
	if (data && data.params) {
		form.append('params', data.params);
	}

	const { response, body } = await request.post(uploadEndPoint, {
		data: form,
		jar: jar,
		validateStatus: null,
		headers: {
			'x-csrf-token': csrf_token,
			...form.getHeaders(),
		},
	});
	if (response.status !== 200) {
		winston.error(JSON.stringify(data));
	}
	return { response, body };
};

helpers.registerUser = async function (data) {
	const jar = request.jar();
	const csrf_token = await helpers.getCsrfToken(jar);

	if (!data.hasOwnProperty('password-confirm')) {
		data['password-confirm'] = data.password;
	}

	const { response, body } = await request.post(`${nconf.get('url')}/register`, {
		data,
		jar,
		validateStatus: () => true,
		headers: {
			'x-csrf-token': csrf_token,
		},
	});
	return { jar, response, body };
};

// http://stackoverflow.com/a/14387791/583363
helpers.copyFile = function (source, target, callback) {
	let cbCalled = false;

	const rd = fs.createReadStream(source);
	rd.on('error', (err) => {
		done(err);
	});
	const wr = fs.createWriteStream(target);
	wr.on('error', (err) => {
		done(err);
	});
	wr.on('close', () => {
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

helpers.invite = async function (data, uid, jar, csrf_token) {
	const { response, body } = await request.post(`${nconf.get('url')}/api/v3/users/${uid}/invites`, {
		jar: jar,
		data: data,
		headers: {
			'x-csrf-token': csrf_token,
		},
		validateStatus: null,
	});
	console.log(response.status, body);

	return { response, body };
};

helpers.createFolder = async function (path, folderName, jar, csrf_token) {
	return await request.put(`${nconf.get('url')}/api/v3/files/folder`, {
		jar,
		data: {
			path,
			folderName,
		},
		headers: {
			'x-csrf-token': csrf_token,
		},
		validateStatus: null,
	});
};

require('../../src/promisify')(helpers);
