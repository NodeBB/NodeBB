
'use strict';

var bcrypt = require('bcryptjs'),
	async = require('async');


process.on('message', function(msg) {
	if (msg.type === 'hash') {
		hashPassword(msg.password, msg.rounds);
	} else if (msg.type === 'compare') {
		compare(msg.password, msg.hash);
	}
});

function hashPassword(password, rounds) {
	async.waterfall([
		function(next) {
			bcrypt.genSalt(parseInt(rounds, 10), next);
		},
		function(salt, next) {
			bcrypt.hash(password, salt, next);
		}
	], function(err, hash) {
		if (err) {
			process.send({err: err.message});
			return process.disconnect();
		}
		process.send({result: hash});
		process.disconnect();
	});
}

function compare(password, hash) {
	bcrypt.compare(password, hash, function(err, res) {
		if (err) {
			process.send({err: err.message});
			return process.disconnect();
		}
		process.send({result: res});
		process.disconnect();
 	});
}