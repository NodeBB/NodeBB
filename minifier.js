var uglifyjs = require('uglify-js'),
	less = require('less'),
	async = require('async'),
	fs = require('fs'),

	Minifier = {
		js: {},
		css: {}
	};

/* Javascript */
Minifier.js.minify = function (scripts, callback) {
	try {
		var minified = uglifyjs.minify(scripts);
		callback(minified.code);
	} catch(err) {
		process.send({
			action: 'error',
			error: err
		});
	}
};

Minifier.js.concatenate = function(scripts, callback) {
	async.map(scripts, function(path, next) {
		fs.readFile(path, { encoding: 'utf-8' }, next);
	}, function(err, contents) {
		if (err) {
			process.send({
				action: 'error',
				error: err
			});
		} else {
			callback(contents.reduce(function(output, src) {
				return output.length ? output + ';\n' + src : src;
			}, ''));
		}
	});
};

process.on('message', function(payload) {
	var	executeCallback = function(data) {
			process.send({
				action: payload.action,
				data: data
			});
		};

	switch(payload.action) {
		case 'js.minify':
			Minifier.js.minify(payload.scripts, executeCallback);
		break;

		case 'js.concatenate':
			Minifier.js.concatenate(payload.scripts, executeCallback);
		break;
	}
})
