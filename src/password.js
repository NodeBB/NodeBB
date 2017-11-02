'use strict';

var path = require('path');

var fork = require('./meta/debugFork');

function hash(rounds, password, callback) {
	forkChild({ type: 'hash', rounds: rounds, password: password }, callback);
}

exports.hash = hash;

var fakeHashCache;
function getFakeHash(callback) {
	if (fakeHashCache) {
		return callback(null, fakeHashCache);
	}

	hash(12, Math.random().toString(), function (err, hash) {
		if (err) {
			return callback(err);
		}

		fakeHashCache = hash;
		callback(null, fakeHashCache);
	});
}

function compare(password, hash, callback) {
	getFakeHash(function (err, fakeHash) {
		if (err) {
			return callback(err);
		}

		forkChild({ type: 'compare', password: password, hash: hash || fakeHash }, callback);
	});
}

exports.compare = compare;

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
