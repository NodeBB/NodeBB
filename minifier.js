"use strict";

var uglifyjs = require('uglify-js'),
	less = require('less'),
	async = require('async'),
	fs = require('fs'),
	path = require('path'),

	Minifier = {
		js: {},
		css: {}
	};

/* Javascript */
Minifier.js.minify = function (scripts, minify, callback) {
	var options = {};

	scripts = scripts.filter(function(file) {
		return fs.existsSync(file);
	});

	if (!minify) {
		options.sourceMapURL = '/nodebb.min.js.map';
		options.outSourceMap = 'nodebb.min.js.map';
		options.mangle = false;
		options.compress = false;
		options.prefix = __dirname.split(path.sep).length;
	}

	try {
		var minified = uglifyjs.minify(scripts, options);
		callback({
			js: minified.code,
			map: minified.map
		});
	} catch(err) {
		process.send({
			action: 'error',
			error: {
				message: err.message
			}
		});
	}
};

// Minifier.js.concatenate = function(scripts, callback) {
// 	async.map(scripts, function(path, next) {
// 		fs.readFile(path, { encoding: 'utf-8' }, next);
// 	}, function(err, contents) {
// 		if (err) {
// 			process.send({
// 				action: 'error',
// 				error: err
// 			});
// 		} else {
// 			callback(contents.reduce(function(output, src) {
// 				return output.length ? output + ';\n' + src : src;
// 			}, ''));
// 		}
// 	});
// };

process.on('message', function(payload) {
	var	executeCallback = function(data) {
			process.send({
				action: payload.action,
				data: data
			});
		};

	switch(payload.action) {
	case 'js':
		Minifier.js.minify(payload.scripts, payload.minify, executeCallback);
		break;
	}
});
