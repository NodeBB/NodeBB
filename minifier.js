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
Minifier.js.minify = function (scripts, minify, callback) {
	scripts = scripts.filter(function(file) {
		return fs.existsSync(file);
	});

	if (minify) {
		minifyScripts(scripts, function() {
			callback.apply(this, arguments);
		});
	} else {
		concatenateScripts(scripts, callback);
	}
};

process.on('message', function(payload) {
	switch(payload.action) {
	case 'js':
		Minifier.js.minify(payload.scripts, payload.minify, function(minified) {
			process.send({
				type: 'end',
				minified: minified
			});
		});
		break;
	}
});

function minifyScripts(scripts, callback) {
	try {
		var minified = uglifyjs.minify(scripts, {
				compress: false
			}),
			hasher = crypto.createHash('md5'),
			hash;

		// Calculate js hash
		hasher.update(minified.code, 'utf-8');
		hash = hasher.digest('hex');
		process.send({
			type: 'hash',
			payload: hash.slice(0, 8)
		});

		callback(minified.code);
	} catch(err) {
		process.send({
			type: 'error',
			payload: err.message
		});
	}
}

function concatenateScripts(scripts, callback) {
	async.map(scripts, fs.readFile, function(err, scripts) {
		if (err) {
			process.send({
				type: 'error',
				payload: err
			});
		}

		scripts = scripts.join(require('os').EOL + ';');

		callback(scripts);
	});
}