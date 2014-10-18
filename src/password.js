'use strict';

(function(module) {
	var fork = require('child_process').fork;

	module.hash = function(rounds, password, callback) {
		var child = fork('./bcrypt', ['hash', rounds, password], {
				silent: true
			}),
			response = '';

		child.stdout.on('data', function(chunk) {
			response += chunk.toString();
		});

		child.stdout.on('end', function() {
			callback(null, response);
		});
	};

	module.compare = function(password, hash, callback) {
		var child = fork('./bcrypt', ['compare', password, hash], {
				silent: true
			}),
			response = '';

		child.stdout.on('data', function(chunk) {
			response += chunk.toString();
		});

		child.stdout.on('end', function() {
			callback(null, response === 'true');
		});
	};

	return module;
})(exports);