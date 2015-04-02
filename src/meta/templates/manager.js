"use strict";

var path = require('path'),
	winston = require('winston'),
	compilers = {};

module.exports = function(Templates) {
	Templates.registerCompiler = function(extension, compiler) {
		compilers[extension] = compiler;
	};

	Templates.compileTemplate = function(paths, relativePath, targetPath, callback) {
		var ext = path.extname(relativePath);
		var compiler = compilers[ext];

		if (!compiler) {
			winston.error('[meta/templates] Compiler not found for extension ' + ext);
			callback(new Error('Compiler not found for extension ' + ext));
			return;
		}

		compiler(paths, relativePath, targetPath, callback);
	};
};

