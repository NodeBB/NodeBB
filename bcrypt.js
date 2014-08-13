
'use strict';


var bcrypt = require('bcryptjs');

process.on('message', function(m) {
	if (m.type === 'hash') {
		hash(m.rounds, m.password);
	} else if (m.type === 'compare') {
		compare(m.password, m.hash);
	}
});

function hash(rounds, password) {
	bcrypt.genSalt(rounds, function(err, salt) {
		if (err) {
			return process.send({type:'hash', err: {message: err.message}});
		}
		bcrypt.hash(password, salt, function(err, hash) {
			process.send({type:'hash', err: err ? {message: err.message} : null, hash: hash, password: password});
		});
	});
}

function compare(password, hash) {
	bcrypt.compare(password, hash, function(err, res) {
		process.send({type:'compare', err: err ? {message: err.message} : null, hash: hash, password: password, result: res});
	});
}