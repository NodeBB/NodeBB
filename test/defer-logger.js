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

before(() => {
	// defer winston logs until the end
	winston.clear();

	winston.add(new DeferLogger({ logged: winstonLogged }));
});

after(() => {
	console.log('\n\n');

	winstonLogged.forEach((args) => {
		console.log(`${args[0]} ${args[1]}`);
	});
});
