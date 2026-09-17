'use strict';


const assert = require('assert');
const nconf = require('nconf');

const db = require('./mocks/databasemock');

const clientIp = require('../src/ip');

describe('client ip', () => {
	let originalTrustProxy;

	before(() => {
		originalTrustProxy = nconf.get('trust_proxy');
	});

	after(() => {
		nconf.set('trust_proxy', originalTrustProxy);
	});

	it('should use remoteAddress when trust_proxy is false', () => {
		nconf.set('trust_proxy', false);
		const ip = clientIp.getClientIp({
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
		const ip = clientIp.getClientIp({
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
		const ip = clientIp.getClientIp({
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
		const ip = clientIp.getClientIp({
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
		assert.strictEqual(clientIp.getClientIp(null), '');
	});

	it('should normalize IPv4-mapped IPv6 addresses', () => {
		nconf.set('trust_proxy', false);
		const ip = clientIp.getClientIp({
			headers: {},
			socket: { remoteAddress: '::ffff:192.0.2.1' },
		});

		assert.strictEqual(ip, '192.0.2.1');
	});

	it('should record a normalized ip on write api payloads', () => {
		const apiHelpers = require('../src/api/helpers');
		nconf.set('trust_proxy', false);
		const data = {};
		apiHelpers.setDefaultPostData({
			uid: 1,
			headers: {},
			ip: '::ffff:192.0.2.1',
			socket: { remoteAddress: '::ffff:192.0.2.1' },
		}, data);

		assert.strictEqual(data.ip, '192.0.2.1');
	});
});
