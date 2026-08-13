'use strict';

const assert = require('assert');
const { fork } = require('child_process');
const path = require('path');

describe('sendWorker', () => {
	let worker;

	afterEach((done) => {
		if (worker) {
			worker.kill('SIGKILL');
			worker.on('exit', done);
		} else {
			done();
		}
	});

	describe('IPC protocol', () => {
		it('should emit a ready message on startup', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				assert.strictEqual(message.type, 'ready');
				done();
			});
		});

		it('should emit a result message on successful send', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			let readyReceived = false;

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					readyReceived = true;
					// Send a task to a non-existent endpoint (will fail, but tests the protocol)
					worker.send({
						type: 'send',
						id: 'test-task-1',
						uri: 'https://nonexistent.invalid/test',
						payload: JSON.stringify({ type: 'Create' }),
						digest: 'SHA-256=invalid',
						key: { privateKeyPem: 'dummy' },
						keyId: 'https://example.org/actor#key',
					});
				} else if (message.type === 'result' && readyReceived) {
					assert.strictEqual(message.id, 'test-task-1');
					assert.strictEqual(message.success, false); // Will fail due to invalid key
					done();
				}
			});
		});

		it('should handle shutdown message and exit', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					worker.send({ type: 'shutdown' });
				}
			});

			worker.on('exit', (code) => {
				assert.strictEqual(code, 1); // Worker exits with code 1 on shutdown
				done();
			});
		});

		it('should reject malformed messages', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					// Send malformed messages
					worker.send(null);
					worker.send({});
					worker.send({ type: 'unknown-type' });
					// After a short delay, send shutdown
					setTimeout(() => {
						worker.send({ type: 'shutdown' });
					}, 100);
				}
			});

			worker.on('exit', (code) => {
				assert.strictEqual(code, 1);
				done();
			});
		});
	});

	describe('SSRF protection', () => {
		it('should reject localhost URLs', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					worker.send({
						type: 'send',
						id: 'ssrf-test-1',
						uri: 'https://127.0.0.1/test',
						payload: JSON.stringify({ type: 'Create' }),
						digest: 'SHA-256=invalid',
						key: { privateKeyPem: 'dummy' },
						keyId: 'https://example.org/actor#key',
					});
				} else if (message.type === 'result' && message.id === 'ssrf-test-1') {
					assert.strictEqual(message.success, false);
					assert(message.error.toLowerCase().includes('ssrf') || message.error.toLowerCase().includes('forbidden'));
					done();
				}
			});
		});

		it('should reject private IP URLs', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					worker.send({
						type: 'send',
						id: 'ssrf-test-2',
						uri: 'https://192.168.1.1/test',
						payload: JSON.stringify({ type: 'Create' }),
						digest: 'SHA-256=invalid',
						key: { privateKeyPem: 'dummy' },
						keyId: 'https://example.org/actor#key',
					});
				} else if (message.type === 'result' && message.id === 'ssrf-test-2') {
					assert.strictEqual(message.success, false);
					assert(message.error.toLowerCase().includes('ssrf') || message.error.toLowerCase().includes('forbidden'));
					done();
				}
			});
		});

		it('should reject link-local IP URLs', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					worker.send({
						type: 'send',
						id: 'ssrf-test-3',
						uri: 'https://169.254.169.254/latest/meta-data/',
						payload: JSON.stringify({ type: 'Create' }),
						digest: 'SHA-256=invalid',
						key: { privateKeyPem: 'dummy' },
						keyId: 'https://example.org/actor#key',
					});
				} else if (message.type === 'result' && message.id === 'ssrf-test-3') {
					assert.strictEqual(message.success, false);
					assert(message.error.toLowerCase().includes('ssrf') || message.error.toLowerCase().includes('forbidden'));
					done();
				}
			});
		});
	});

	describe('Task timeout', () => {
		it('should handle tasks that exceed the timeout', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					// Send a task to a URL that will hang (no response)
					worker.send({
						type: 'send',
						id: 'timeout-test-1',
						uri: 'https://httpbin.org/delay/60', // Will hang for 60s
						payload: JSON.stringify({ type: 'Create' }),
						digest: 'SHA-256=invalid',
						key: { privateKeyPem: 'dummy' },
						keyId: 'https://example.org/actor#key',
					});
				} else if (message.type === 'result' && message.id === 'timeout-test-1') {
					// Should fail due to timeout
					assert.strictEqual(message.success, false);
					assert(message.error.toLowerCase().includes('abort') || message.error.toLowerCase().includes('timeout'));
					done();
				}
			});

			// Safety timeout — if the test takes too long, kill the worker
			setTimeout(() => {
				worker.kill('SIGKILL');
				done(new Error('Test timed out — worker did not respond within 15s'));
			}, 15000);
		});
	});

	describe('Uncaught exception handling', () => {
		it('should exit with code 1 on uncaught exception', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					// Send a task that will cause an uncaught exception
					// by providing an invalid key that causes signing to throw
					worker.send({
						type: 'send',
						id: 'exception-test-1',
						uri: 'https://example.org/test',
						payload: JSON.stringify({ type: 'Create' }),
						digest: 'SHA-256=invalid',
						key: null, // Invalid key — should cause signing to throw
						keyId: 'https://example.org/actor#key',
					});
				}
			});

			worker.on('exit', (code) => {
				// The worker should exit with code 1 on uncaught exception
				assert.strictEqual(code, 1);
				done();
			});

			// Safety timeout
			setTimeout(() => {
				worker.kill('SIGKILL');
				done(new Error('Test timed out — worker did not exit within 15s'));
			}, 15000);
		});
	});
});
