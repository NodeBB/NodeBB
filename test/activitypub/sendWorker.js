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

	describe('RFC 9421 signing with draft fallback', () => {
		const http = require('http');
		const { createHash, generateKeyPairSync, webcrypto } = require('crypto');
		const sfv = require('structured-headers');
		const {
			RFC9421SignatureBaseFactory,
			importPublicKey,
			parseDraftRequest,
			verifyDraftSignature,
		} = require('@misskey-dev/node-http-message-signatures');

		let innerPool;
		let server;
		let port;
		let requests;
		let pubPem;
		let privPem;
		const keyId = 'https://nodebb.test/actor#key';

		before(async () => {
			const kp = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
			privPem = kp.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
			pubPem = kp.publicKey.export({ format: 'pem', type: 'spki' }).toString();
		});

		beforeEach(async () => {
			requests = [];

			server = http.createServer((req, res) => {
				const chunks = [];
				req.on('data', (c) => chunks.push(c));
				req.on('end', async () => {
					const raw = Buffer.concat(chunks);
					const fullUrl = `http://127.0.0.1:${port}${req.url}`;
					const entry = {
						hasRfc: !!req.headers['signature-input'],
						isDraft: typeof req.headers.signature === 'string' && req.headers.signature.includes('keyId="'),
						digestOk: req.headers.digest === `SHA-256=${createHash('sha256').update(raw).digest('base64')}`,
					};
					try {
						if (entry.hasRfc) {
							const base = new RFC9421SignatureBaseFactory({ method: req.method, url: fullUrl, headers: req.headers });
							// Parse the Signature header as a strict RFC 8941/9651 dictionary
							// (like Mitra's sfv parser) — the value must be a byte sequence
							const sigDict = sfv.parseDictionary(String(req.headers.signature));
							const sigItem = sigDict.get('sig1');
							if (!sigItem || !sfv.isByteSequence(sigItem[0])) {
								throw new Error('Signature value is not a byte sequence');
							}
							const pub = await importPublicKey(pubPem, ['verify']);
							entry.rfcValid = await webcrypto.subtle.verify(
								{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
								pub,
								Buffer.from(sigItem[0].base64Value, 'base64'),
								new TextEncoder().encode(base.generate('sig1')),
							);
						} else if (entry.isDraft) {
							const parsed = parseDraftRequest({ method: req.method, url: fullUrl, headers: req.headers });
							entry.draftValid = await verifyDraftSignature(parsed.value, pubPem);
						}
					} catch (e) {
						entry.verifyError = e.message;
					}
					requests.push(entry);
					const accepted = (server.mode === 'rfc' && entry.hasRfc && entry.rfcValid === true) ||
						(server.mode === 'draft' && entry.isDraft && entry.draftValid === true);
					res.writeHead(accepted ? 202 : 401, { 'content-type': 'application/json' });
					res.end(JSON.stringify({ accepted }));
				});
			});
			await new Promise((resolve) => {
				server.listen(0, '127.0.0.1', resolve);
			});
			port = server.address().port;

			innerPool = workerpool.pool(path.join(__dirname, '../../src/activitypub/sendWorker.js'), {
				minWorkers: 1,
				maxWorkers: 1,
				workerType: 'process',
				forkOpts: {
					silent: true,
					execArgv: ['--require', require.resolve('./ssrf-allow-localhost')],
				},
			});
		});

		afterEach((done) => {
			Promise.all([
				innerPool ? innerPool.terminate(true, 1000) : Promise.resolve(),
				new Promise((resolve) => server.close(resolve)),
			]).then(() => done()).catch(() => done());
		});

		function task(mode) {
			const payload = JSON.stringify({ id: 'https://nodebb.test/activities/1', type: 'Create' });
			return {
				id: `rfc-fallback-${mode}`,
				uri: `http://127.0.0.1:${port}/inbox`,
				payload,
				digest: `SHA-256=${createHash('sha256').update(payload).digest('base64')}`,
				key: privPem,
				keyId,
			};
		}

		it('should sign with RFC 9421 and not fall back when the server accepts it', async () => {
			server.mode = 'rfc';
			const result = await innerPool.exec('send', [task('rfc')], { timeout: 30000 });

			assert.strictEqual(result.success, true);
			assert.strictEqual(requests.length, 1);
			assert(requests[0].hasRfc, 'request should carry a signature-input header');
			assert.strictEqual(requests[0].rfcValid, true, 'RFC 9421 signature should verify');
			assert.strictEqual(requests[0].digestOk, true, 'digest should match payload');
		});

		it('should fall back to a draft signature when the server rejects RFC 9421', async () => {
			server.mode = 'draft';
			const result = await innerPool.exec('send', [task('draft')], { timeout: 30000 });

			assert.strictEqual(result.success, true);
			assert.strictEqual(requests.length, 2);
			assert(requests[0].hasRfc, 'first attempt should use RFC 9421');
			assert(requests[1].isDraft, 'fallback attempt should use the draft signature');
			assert.strictEqual(requests[1].draftValid, true, 'draft signature should verify');
			assert.strictEqual(requests[1].digestOk, true, 'digest should match payload');
		});

		it('should fail when the server rejects both signature schemes', async () => {
			server.mode = 'none';
			const result = await innerPool.exec('send', [task('none')], { timeout: 30000 });

			assert.strictEqual(result.success, false);
			assert.strictEqual(requests.length, 2);
			assert(result.error.includes('401'));
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
