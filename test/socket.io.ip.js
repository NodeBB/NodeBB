'use strict';


const assert = require('assert');
const nconf = require('nconf');

const db = require('./mocks/databasemock');

const socketIp = require('../src/socket.io/utils/ip');

describe('socket.io ip utils', () => {
	let originalTrustProxy;

	before(() => {
		originalTrustProxy = nconf.get('trust_proxy');
	});

	after(() => {
		nconf.set('trust_proxy', originalTrustProxy);
	});

	it('should use remoteAddress when trust_proxy is false', () => {
		nconf.set('trust_proxy', false);
		const ip = socketIp.getClientIp({
			headers: {
				'x-forwarded-for': '203.0.113.1, 198.51.100.1',
			},
			socket: {
				remoteAddress: '192.0.2.1',
			},
		});

		assert.strictEqual(ip, '192.0.2.1');
	});

	it('should use forwarded client address when trust_proxy is true', () => {
		nconf.set('trust_proxy', true);
		const ip = socketIp.getClientIp({
			headers: {
				'x-forwarded-for': '203.0.113.1, 198.51.100.1',
			},
			socket: {
				remoteAddress: '192.0.2.1',
			},
		});

		assert.strictEqual(ip, '203.0.113.1');
	});

	it('should honor numeric trust proxy hop counts', () => {
		nconf.set('trust_proxy', 1);
		const ip = socketIp.getClientIp({
			headers: {
				'x-forwarded-for': '203.0.113.1, 198.51.100.1',
			},
			socket: {
				remoteAddress: '192.0.2.1',
			},
		});

		assert.strictEqual(ip, '198.51.100.1');
	});

	it('should fall back to remoteAddress when forwarded chain is invalid', () => {
		nconf.set('trust_proxy', true);
		const ip = socketIp.getClientIp({
			headers: {
				'x-forwarded-for': '<script>alert("xss")</script>',
			},
			socket: {
				remoteAddress: '192.0.2.1',
			},
		});

		assert.strictEqual(ip, '192.0.2.1');
	});

	it('should return empty string without request', () => {
		nconf.set('trust_proxy', false);
		assert.strictEqual(socketIp.getClientIp(null), '');
	});
});
