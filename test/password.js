'use strict';

const assert = require('assert');
const bcrypt = require('bcryptjs');

const password = require('../src/password');

describe('Password', () => {
	describe('.hash()', () => {
		it('should return a password hash when called', async () => {
			const hash = await password.hash(12, 'test');
			assert(hash.startsWith('$2a$'));
		});
	});

	describe('.compare()', () => {
		it('should correctly compare a password and a hash', async () => {
			const hash = await password.hash(12, 'test');
			const match = await password.compare('test', hash, true);
			assert(match);
		});

		it('should correctly handle comparison with no sha wrapping of the input (backwards compatibility)', async () => {
			const hash = await bcrypt.hash('test', await bcrypt.genSalt(12));
			const match = await password.compare('test', hash, false);
			assert(match);
		});
	});
});
