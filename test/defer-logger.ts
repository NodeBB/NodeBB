'use strict';

import winston from 'winston';
const Transport = require('winston-transport');

const winstonLogged : any[] = [];

class DeferLogger extends Transport {
	public logged;
	public emit;

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
