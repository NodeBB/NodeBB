

'use strict';
var fork = require('child_process').fork;

(function(module) {

	var child = fork('./bcrypt', process.argv.slice(2), {
					env: process.env
				});

	var callbacks = {
		'hash': {},
		'compare': {}
	};

	module.hash = function(rounds, password, callback) {
		sendCommand({type: 'hash', password: password, rounds: rounds}, callback);
	};

	module.compare = function(password, hash, callback) {
		sendCommand({type: 'compare', password: password, hash: hash}, callback);
	};

	function sendCommand(data, callback) {
		callbacks[data.type][data.password] = callbacks[data.type][data.password] || [];
		callbacks[data.type][data.password].push(callback);
		child.send(data);
	}

	child.on('message', function(msg) {
		var cbs = callbacks[msg.type] ? callbacks[msg.type][msg.password] : null;

		if (Array.isArray(cbs)) {
			if (msg.err) {
				var err = new Error(msg.err.message);
				cbs.forEach(function(callback) {
					callback(err);
				});
				cbs.length = 0;
				return;
			}

			cbs.forEach(function(callback) {
				callback(null, msg.type === 'hash' ? msg.hash : msg.result);
			});
			cbs.length = 0;
		}
	});

}(exports));
