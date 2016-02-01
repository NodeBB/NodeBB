"use strict";

var uglifyjs = require('uglify-js');
var async = require('async');
var fs = require('fs');
var file = require('./src/file');

var Minifier = {
	js: {}
};

/* Javascript */
Minifier.js.minify = function (scripts, minify, callback) {

	scripts = scripts.filter(function(file) {
		return file && file.endsWith('.js');
	});

	async.filter(scripts, function(script, next) {
		file.exists(script, function(exists) {
			if (!exists) {
				console.warn('[minifier] file not found, ' + script);
			}
			next(exists);
		});
	}, function(scripts) {
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
			message: err.message
		});
	}
}

function concatenateScripts(scripts, callback) {
	async.map(scripts, fs.readFile, function(err, scripts) {
		if (err) {
			process.send({
				type: 'error',
				message: err.message
			});
			return;
		}

		scripts = scripts.join(require('os').EOL + ';');

		callback(scripts);
	});
}