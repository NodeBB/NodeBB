"use strict";

var uglifyjs = require('uglify-js'),
	less = require('less'),
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	crypto = require('crypto'),

	Minifier = {
		js: {}
	};

/* Javascript */
Minifier.js.minify = function (scripts, relativePath, minify, callback) {
	var options = {
		compress: false
	};

	scripts = scripts.filter(function(file) {
		return fs.existsSync(file);
	});

	if (!minify) {
		options.sourceMapURL = '/nodebb.min.js.map';
		options.outSourceMap = 'nodebb.min.js.map';
		options.sourceRoot = relativePath;
		options.mangle = false;
		options.prefix = 1;
	}

	try {
		var minified = uglifyjs.minify(scripts, options),
			hasher = crypto.createHash('md5'),
			hash;

		// Calculate js hash
		hasher.update(minified.code, 'utf-8');
		hash = hasher.digest('hex');
		process.send({
			type: 'hash',
			payload: hash.slice(0, 8)
		});

		callback({
			js: minified.code,
			map: minified.map
		});
	} catch(err) {
		process.send({
			type: 'error',
			payload: err
		});
	}
};

process.on('message', function(payload) {
	switch(payload.action) {
	case 'js':
		Minifier.js.minify(payload.scripts, payload.relativePath, payload.minify, function(data) {
			process.send({
				type: 'end',
				data: data
			});
		});
		break;
	}
});