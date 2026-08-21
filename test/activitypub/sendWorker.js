'use strict';

const assert = require('assert');
const path = require('path');
const workerpool = require('workerpool');

describe('sendWorker', () => {
	let pool;

	beforeEach(() => {
		pool = workerpool.pool(path.join(__dirname, '../../src/activitypub/sendWorker.js'), {
			minWorkers: 1,
			maxWorkers: 1,
			workerType: 'process',
			forkOpts: { silent: true },
		});
	});

	afterEach((done) => {
		pool.terminate(true, 1000).then(() => {
			done();
		}).catch(() => {
			done();
		});
	});

	describe('send task', () => {
		it('should emit a result on failed send', async () => {
			const result = await pool.exec('send', [{
				id: 'test-task-1',
				uri: 'https://nonexistent.invalid/test',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=invalid',
				key: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----',
				keyId: 'https://example.org/actor#key',
			}], { timeout: 10000 });
			assert.strictEqual(result.success, false);
		});

		it('should reject tasks with missing fields', async () => {
			let result;
			try {
				result = await pool.exec('send', [{
					id: 'missing-fields-test',
					uri: 'https://example.org/test',
					// Missing payload, digest, key, keyId
				}], { timeout: 5000 });
			} catch (e) {
				result = { success: false, error: e.message };
			}
			assert.strictEqual(result.success, false);
			assert(result.error.toLowerCase().includes('missing'));
		});
	});

	describe('SSRF protection', () => {
		it('should reject localhost URLs', async () => {
			const result = await pool.exec('send', [{
				id: 'ssrf-test-1',
				uri: 'https://127.0.0.1/test',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=invalid',
				key: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----',
				keyId: 'https://example.org/actor#key',
			}], { timeout: 10000 });
			assert.strictEqual(result.success, false);
			assert(result.error.toLowerCase().includes('ssrf') || result.error.toLowerCase().includes('forbidden'));
		});

		it('should reject private IP URLs', async () => {
			const result = await pool.exec('send', [{
				id: 'ssrf-test-2',
				uri: 'https://192.168.1.1/test',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=invalid',
				key: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----',
				keyId: 'https://example.org/actor#key',
			}], { timeout: 10000 });
			assert.strictEqual(result.success, false);
			assert(result.error.toLowerCase().includes('ssrf') || result.error.toLowerCase().includes('forbidden'));
		});

		it('should reject link-local IP URLs', async () => {
			const result = await pool.exec('send', [{
				id: 'ssrf-test-3',
				uri: 'https://169.254.169.254/latest/meta-data/',
				payload: JSON.stringify({ type: 'Create' }),
				digest: 'SHA-256=invalid',
				key: '-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----',
				keyId: 'https://example.org/actor#key',
			}], { timeout: 10000 });
			assert.strictEqual(result.success, false);
			assert(result.error.toLowerCase().includes('ssrf') || result.error.toLowerCase().includes('forbidden'));
		});
	});
});
