'use strict';

var path = require('path');
var bcrypt = require('bcryptjs');
var async = require('async');

var fork = require('./meta/debugFork');

exports.hash = function (rounds, password, callback) {
	forkChild({ type: 'hash', rounds: rounds, password: password }, callback);
};

exports.compare = function (password, hash, callback) {
	async.waterfall([
		getFakeHash,
		function (fakeHash, next) {
			forkChild({ type: 'compare', password: password, hash: hash || fakeHash }, next);
		},
	], callback);
};

var fakeHashCache;
function getFakeHash(callback) {
	if (fakeHashCache) {
		return callback(null, fakeHashCache);
	}
	async.waterfall([
		function (next) {
			exports.hash(12, Math.random().toString(), next);
		},
		function (hash, next) {
			fakeHashCache = hash;
			next(null, fakeHashCache);
		},
	], callback);
}

function forkChild(message, callback) {
	var child = fork(path.join(__dirname, 'password'));

	child.on('message', function (msg) {
		callback(msg.err ? new Error(msg.err) : null, msg.result);
	});

	child.send(message);
}

// child process
process.on('message', function (msg) {
	if (msg.type === 'hash') {
		hashPassword(msg.password, msg.rounds);
	} else if (msg.type === 'compare') {
		bcrypt.compare(String(msg.password || ''), String(msg.hash || ''), done);
	}
});

function hashPassword(password, rounds) {
	async.waterfall([
		function (next) {
			bcrypt.genSalt(parseInt(rounds, 10), next);
		},
		function (salt, next) {
			bcrypt.hash(password, salt, next);
		},
	], done);
}

function done(err, result) {
	process.send(err ? { err: err.message } : { result: result });
	process.disconnect();
}
