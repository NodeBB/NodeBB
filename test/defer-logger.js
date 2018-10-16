'use strict';

var winston = require('winston');
var Transport = require('winston-transport');

var winstonLogged = [];

class DeferLogger extends Transport {
	constructor(opts) {
		super(opts);
		this.logged = opts.logged;
	}

	log(info, callback) {
		setImmediate(() => {
			this.emit('logged', info);
		});

		this.logged.push([info.level, info.message]);
		callback();
	}
}

before(function () {
	// defer winston logs until the end
	winston.clear();

	winston.add(new DeferLogger({ logged: winstonLogged }));
});

after(function () {
	console.log('\n\n');

	winstonLogged.forEach(function (args) {
		console.log(args[0] + ' ' + args[1]);
	});
});
