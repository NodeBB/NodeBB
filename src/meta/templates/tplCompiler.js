var fs = require('fs'),
	winston = require('winston'),
	mkdirp = require('mkdirp'),
	path = require('path'),
	importRegex = /[ \t]*<!-- IMPORT ([\s\S]*?)? -->[ \t]*/;

function compiler(paths, relativePath, targetPath,  callback) {
	var filePath = paths[relativePath];
	fs.readFile(filePath, function(err, file) {
		if (err) {
			callback(err);
			return;
		};

		var matches = null;
		file = file.toString();

		while((matches = file.match(importRegex)) !== null) {
			var partial = "/" + matches[1];

			if (paths[partial] && relativePath !== partial) {
				file = file.replace(importRegex, fs.readFileSync(paths[partial]).toString());
			} else {
				winston.warn('[meta/templates] Partial not loaded: ' + matches[1]);
				file = file.replace(importRegex, "");
			}
		}

		mkdirp.sync(path.join(targetPath, relativePath.split('/').slice(0, -1).join('/')));
		fs.writeFile(path.join(targetPath, relativePath), file, function(err) {
			callback(err, file);
		});
	});
};

module.exports = function(Templates) {
	Templates.registerCompiler('.tpl', compiler);
};
