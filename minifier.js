"use strict";

var uglifyjs = require('uglify-js'),
	less = require('less'),
	async = require('async'),
	fs = require('fs'),
	file = require('./src/file'),
	crypto = require('crypto'),
	utils = require('./public/src/utils'),

	Minifier = {
		js: {}
	};

/* Javascript */
Minifier.js.minify = function (scripts, minify, callback) {
	scripts = scripts.filter(function(file) {
		return file && file.endsWith('.js');
	});

	async.filter(scripts, file.exists, function(scripts) {
		if (minify) {
			minifyScripts(scripts, callback);
		} else {
			concatenateScripts(scripts, callback);
		}
	});
};

process.on('message', function(payload) {
	switch(payload.action) {
	case 'js':
		Minifier.js.minify(payload.scripts, payload.minify, function(minified/*, sourceMap*/) {
			process.send({
				type: 'end',
				// sourceMap: sourceMap,
				minified: minified
			});
		});
		break;
	}
});

function minifyScripts(scripts, callback) {
	// The portions of code involving the source map are commented out as they're broken in UglifyJS2
	// Follow along here: https://github.com/mishoo/UglifyJS2/issues/700
	try {
		var minified = uglifyjs.minify(scripts, {
				// outSourceMap: "nodebb.min.js.map",
				compress: false
			});

		callback(minified.code/*, minified.map*/);
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
			return;
		}

		scripts = scripts.join(require('os').EOL + ';');

		callback(scripts);
	});
}