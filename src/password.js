'use strict';

var path = require('path');

var fork = require('./meta/debugFork');

exports.hash = function (rounds, password, callback) {
	forkChild({ type: 'hash', rounds: rounds, password: password }, callback);
};

exports.compare = function (password, hash, callback) {
	if (!hash || !password) {
		return setImmediate(callback, null, false);
	}
	forkChild({ type: 'compare', password: password, hash: hash }, callback);
};

function forkChild(message, callback) {
	var child = fork(path.join(__dirname, 'bcrypt'));

	child.on('message', function (msg) {
		if (msg.err) {
			return callback(new Error(msg.err));
		}

		callback(null, msg.result);
	});

	child.send(message);
}
