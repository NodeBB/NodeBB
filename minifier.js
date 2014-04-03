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
	// winston.info('[meta/js] Minifying client-side libraries...');
	var minified = uglifyjs.minify(scripts);

	callback(minified.code);

	// winston.info('[meta/js] Done.');
};

Minifier.js.concatenate = function(scripts, callback) {
	// winston.info('[meta/js] Concatenating client-side libraries into one file...');

	async.map(scripts, function(path, next) {
		fs.readFile(path, { encoding: 'utf-8' }, next);
	}, function(err, contents) {
		if (err) {
			// winston.error('[meta/js] Could not minify javascript! Error: ' + err.message);
			console.log('ERROR');
			process.exit();
		}

		callback(contents.reduce(function(output, src) {
			return output.length ? output + ';\n' + src : src;
		}, ''));

		// winston.info('[meta/js] Done.');
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