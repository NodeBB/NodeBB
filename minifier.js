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
		compress: false,
		sourceMapURL: '/nodebb.min.js.map',
		outSourceMap: 'nodebb.min.js.map',
		sourceRoot: relativePath
	};

	scripts = scripts.filter(function(file) {
		return fs.existsSync(file);
	});

	if (!minify) {
		options.mangle = false;
		options.prefix = 1;
	}

	if (minify) {
		minifyScripts(scripts, options, callback);
	} else {
		concatenateScripts(scripts, options, callback);
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

function minifyScripts(scripts, options, callback) {
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
}

function concatenateScripts(scripts, options, callback) {
	async.map(scripts, fs.readFile, function(err, scripts) {
		if (err) {
			process.send({
				type: 'error',
				payload: err
			});
		}

		scripts = scripts.join(require('os').EOL);

		callback({
			js: scripts,
			map: ''
		});
	});
}