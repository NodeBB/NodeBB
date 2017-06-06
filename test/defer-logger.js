'use strict';

var util = require('util');
var winston = require('winston');

function DeferLogger(options) {
	options = options || {};

	this.name = 'DeferLogger';
	this.level = options.level || 'info';

	this.logged = options.logged;
}

util.inherits(DeferLogger, winston.Transport);

DeferLogger.prototype.log = function log(level, msg, meta, callback) {
	this.logged.push([level, msg, meta]);
	callback(null, true);
};

var winstonLogged = [];

before(function () {
	// defer winston logs until the end
	winston.remove(winston.transports.Console);

	winston.add(DeferLogger, {
		logged: winstonLogged,
	});
});

after(function () {
	console.log('\n\n');

	var con = new winston.transports.Console();
	winstonLogged.forEach(function (args) {
		con.log(args[0], args[1], args[2], function () {});
	});
});
