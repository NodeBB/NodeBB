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
		options.prefix = 1;
	}

	try {
		var minified = uglifyjs.minify(scripts, options);
		callback({
			js: minified.code,
			map: minified.map
		});
	} catch(err) {
		process.send(err.message);
	}
};

process.on('message', function(payload) {
	switch(payload.action) {
	case 'js':
		Minifier.js.minify(payload.scripts, payload.minify, function(data) {
			process.stdout.write(data.js);
			process.send('end.script');
			process.stderr.write(data.map);
			process.send('end.mapping');
		});
		break;
	}
});