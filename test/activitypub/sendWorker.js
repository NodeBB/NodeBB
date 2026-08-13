'use strict';

const assert = require('assert');
const { fork } = require('child_process');
const path = require('path');

describe('sendWorker', () => {
	let worker;

	afterEach((done) => {
		if (worker) {
			// Worker may have already exited (e.g., from a shutdown test)
			if (worker.killed || worker.exitCode !== null) {
				worker = null;
				return done();
			}
			worker.kill('SIGKILL');
			worker.on('exit', () => {
				worker = null;
				done();
			});
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

		it('should emit a result message on failed send', (done) => {
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
					assert.strictEqual(message.success, false); // Will fail due to DNS resolution
					done();
				}
			});
		});

		it('should handle shutdown message and exit gracefully', (done) => {
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
				assert.strictEqual(code, 0); // Worker exits with code 0 on graceful shutdown
				done();
			});
		});

		it('should ignore malformed messages without crashing', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					// Send malformed messages — worker should ignore them
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
				// Worker should exit gracefully (code 0) after shutdown
				assert.strictEqual(code, 0);
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

	describe('Missing fields validation', () => {
		it('should reject tasks with missing fields', (done) => {
			worker = fork(path.join(__dirname, '../../src/activitypub/sendWorker.js'), [], {
				silent: true,
				env: { AP_SEND_CHILD: 'true' },
			});

			worker.on('message', (message) => {
				if (message.type === 'ready') {
					// Send a task with missing fields
					worker.send({
						type: 'send',
						id: 'missing-fields-test',
						uri: 'https://example.org/test',
						// Missing payload, digest, key, keyId
					});
				} else if (message.type === 'result' && message.id === 'missing-fields-test') {
					assert.strictEqual(message.success, false);
					assert(message.error.toLowerCase().includes('missing'));
					done();
				}
			});
		});
	});
});
