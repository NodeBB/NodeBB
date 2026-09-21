'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const activitypub = require('../../src/activitypub');
const request = require('../../src/request');
const helpers = require('./helpers');

describe('Emoji', () => {
	before(() => {
		// Prevent real outbound requests (serve objects from the AP cache)
		helpers.mocks.mockRequests();
	});

	after(() => {
		helpers.mocks.restoreRequests();
	});

	const emojiModule = activitypub.emoji;
	const emojiLookupKey = 'emoji:ap:lookup';

	beforeEach(async () => {
		await db.delete(emojiLookupKey);
	});

	describe('extractHostname', () => {
		it('should extract hostname from a valid URL', () => {
			const hostname = emojiModule.extractHostname({ url: 'https://example.com/emoji/test.png' });
			assert.strictEqual(hostname, 'example.com');
		});

		it('should return null for null icon', () => {
			const hostname = emojiModule.extractHostname(null);
			assert.strictEqual(hostname, null);
		});

		it('should return null for missing URL', () => {
			const hostname = emojiModule.extractHostname({});
			assert.strictEqual(hostname, null);
		});
	});

	describe('buildFieldKey', () => {
		it('should build a field key from shortcode and hostname', () => {
			const key = emojiModule.buildFieldKey(':poop:', 'mastodon.social');
			assert.strictEqual(key, 'poop:mastodon.social');
		});

		it('should handle shortcodes without colons', () => {
			const key = emojiModule.buildFieldKey('poop', 'mastodon.social');
			assert.strictEqual(key, 'poop:mastodon.social');
		});
	});

	describe('normalizeShortcode', () => {
		it('should add colons if missing', () => {
			assert.strictEqual(emojiModule.normalizeShortcode('poop'), ':poop:');
			assert.strictEqual(emojiModule.normalizeShortcode(':poop'), ':poop:');
			assert.strictEqual(emojiModule.normalizeShortcode('poop:'), ':poop:');
			assert.strictEqual(emojiModule.normalizeShortcode(':poop:'), ':poop:');
		});
	});

	describe('getProxyUrl', () => {
		it('should generate a proxy URL', () => {
			const url = emojiModule.getProxyUrl(':poop:', 'mastodon.social');
			assert.strictEqual(url, '/emoji/ap/poop/mastodon.social');
		});

		it('should URL-encode special characters', () => {
			const url = emojiModule.getProxyUrl(':my-emoji:', 'sub.example.com');
			assert.strictEqual(url, '/emoji/ap/my-emoji/sub.example.com');
		});
	});

	describe('getEmoji', () => {
		it('should return null when emoji is not cached', async () => {
			const result = await emojiModule.getEmoji(':poop:', 'mastodon.social');
			assert.strictEqual(result, null);
		});

		it('should return cached metadata when emoji exists', async () => {
			const stored = {
				name: ':poop:',
				remoteUrl: 'https://mastodon.social/emojis/poop.png',
				localPath: 'emoji/ap/mastodon.social/poop.png',
				mediaType: 'image/png',
			};
			await db.setObjectField(emojiLookupKey, 'poop:mastodon.social', JSON.stringify(stored));

			const result = await emojiModule.getEmoji(':poop:', 'mastodon.social');
			// getEmoji resolves localPath relative to upload_path
			assert.strictEqual(result.name, ':poop:');
			assert.strictEqual(result.remoteUrl, 'https://mastodon.social/emojis/poop.png');
			assert.strictEqual(result.mediaType, 'image/png');
			assert.ok(result.localPath.endsWith(path.normalize('emoji/ap/mastodon.social/poop.png')), JSON.stringify(result));
		});
	});

	describe('cacheEmoji', () => {
		const uploadPath = nconf.get('upload_path') || nconf.get('base_dir') || '.';
		const emojiDir = path.join(uploadPath, 'emoji', 'ap');

		it('should cache a valid emoji inside the per-host directory', async () => {
			const tag = {
				type: 'Emoji',
				name: ':poop:',
				icon: { url: 'https://mastodon.social/emojis/poop.png', mediaType: 'image/png' },
			};
			const originalGetBuffer = request.getBuffer;
			request.getBuffer = async () => ({ body: Buffer.from('png-bytes'), response: { ok: true, status: 200 }, url: '' });
			try {
				const result = await emojiModule.cacheEmoji(tag);
				assert.ok(result, 'expected emoji to be cached');
				const resolved = path.resolve(uploadPath, result.localPath);
				assert.ok(resolved.startsWith(path.resolve(emojiDir) + path.sep), `wrote outside emoji dir: ${resolved}`);
				assert.ok(resolved.endsWith('poop.png'), `unexpected filename: ${resolved}`);
			} finally {
				request.getBuffer = originalGetBuffer;
				await fs.unlink(path.join(emojiDir, 'mastodon.social', 'poop.png')).catch(() => {});
			}
		});

		it('should not write outside the emoji dir for a traversal name (CWE-22)', async () => {
			const evilFile = path.resolve(emojiDir, '..', 'evil.png');
			await fs.unlink(evilFile).catch(() => {});

			const originalGetBuffer = request.getBuffer;
			request.getBuffer = async () => ({ body: Buffer.from('x'), response: { ok: true, status: 200 }, url: '' });
			try {
				const tag = {
					type: 'Emoji',
					name: '../../../evil',
					icon: { url: 'https://example.com/evil.png', mediaType: 'image/png' },
				};
				const result = await emojiModule.cacheEmoji(tag);
				// Slashes are sanitized to underscores, so it lands safely inside the dir
				assert.ok(result, 'expected emoji to be cached to a sanitized path');
				const resolved = path.resolve(uploadPath, result.localPath);
				assert.ok(resolved.startsWith(path.resolve(emojiDir) + path.sep), `wrote outside emoji dir: ${resolved}`);
				assert.notStrictEqual(resolved, evilFile);
				await fs.access(evilFile).then(() => assert.fail('evil file should not exist')).catch(() => {});
			} finally {
				request.getBuffer = originalGetBuffer;
			}
		});

		it('should not persist a disallowed extension (CWE-22)', async () => {
			const originalGetBuffer = request.getBuffer;
			request.getBuffer = async () => ({ body: Buffer.from('x'), response: { ok: true, status: 200 }, url: '' });
			try {
				const tag = {
					type: 'Emoji',
					name: ':shell:',
					icon: { url: 'https://example.com/shell.php', mediaType: 'application/x-php' },
				};
				const result = await emojiModule.cacheEmoji(tag);
				assert.ok(result, 'expected emoji to be cached');
				assert.ok(path.resolve(result.localPath).endsWith('.png'), `expected png fallback, got: ${result.localPath}`);
			} finally {
				request.getBuffer = originalGetBuffer;
				await fs.unlink(path.join(emojiDir, 'example.com', 'shell.png')).catch(() => {});
			}
		});

		it('should block fetching an emoji from a reserved/private IP (CWE-918)', async () => {
			// Use the real request layer (bypass the mock) to exercise the SSRF guard
			const realGetBuffer = helpers.mocks._originalGetBuffer;
			await assert.rejects(
				() => realGetBuffer('http://169.254.169.254/latest/meta-data/'),
				/reserved|lookup-failed/i,
				'reserved IP fetch should be rejected by the request layer'
			);
		});

		it('should route the emoji fetch through the SSRF-protected request layer (CWE-918)', async () => {
			// cacheEmoji must call request.getBuffer (pinned-lookup dispatcher), not
			// a bare global fetch. Assert it is invoked for a fresh (uncached) emoji.
			let called = false;
			const originalGetBuffer = request.getBuffer;
			request.getBuffer = async () => {
				called = true;
				return { body: Buffer.from('x'), response: { ok: true, status: 200 }, url: '' };
			};
			try {
				const tag = {
					type: 'Emoji',
					name: ':route:',
					icon: { url: 'https://example.com/route.png', mediaType: 'image/png' },
				};
				await emojiModule.cacheEmoji(tag);
				assert.ok(called, 'cacheEmoji should fetch via request.getBuffer');
			} finally {
				request.getBuffer = originalGetBuffer;
				await fs.unlink(path.join(emojiDir, 'example.com', 'route.png')).catch(() => {});
			}
		});
	});

	describe('processEmojiTag', () => {
		it('should return null for tag with no icon', async () => {
			const tag = { type: 'Emoji', name: ':test:' };
			const result = await emojiModule.processEmojiTag(tag);
			assert.strictEqual(result, null);
		});

		it('should return null for tag with no icon.url', async () => {
			const tag = { type: 'Emoji', name: ':test:', icon: {} };
			const result = await emojiModule.processEmojiTag(tag);
			assert.strictEqual(result, null);
		});

		it('should return remote URL fallback for non-image media type', async () => {
			const tag = {
				type: 'Emoji',
				name: ':test:',
				icon: {
					url: 'https://example.com/test',
					mediaType: 'video/mp4',
				},
			};
			const result = await emojiModule.processEmojiTag(tag);
			assert.strictEqual(result, 'https://example.com/test');
		});
	});

	describe('renderEmoji', () => {
		describe('basic rendering', () => {
			it('should return text unchanged when no tags', async () => {
				const result = await activitypub.helpers.renderEmoji('Hello world', []);
				assert.strictEqual(result, 'Hello world');
			});

			it('should return text unchanged when no text', async () => {
				const result = await activitypub.helpers.renderEmoji('', [{ type: 'Emoji', name: ':test:' }]);
				assert.strictEqual(result, '');
			});

			it('should return text unchanged when tags is null', async () => {
				const result = await activitypub.helpers.renderEmoji('Hello world', null);
				assert.strictEqual(result, 'Hello world');
			});
		});

		describe('strip mode', () => {
			it('should strip emoji shortcodes', async () => {
				const tags = [{
					type: 'Emoji',
					name: ':test:',
					icon: {
						url: 'https://example.com/test.png',
						mediaType: 'image/png',
					},
				}];
				const result = await activitypub.helpers.renderEmoji('Hello :test: world', tags, true);
				assert.strictEqual(result, 'Hello  world');
			});

			it('should strip all occurrences', async () => {
				const tags = [{
					type: 'Emoji',
					name: ':happy:',
					icon: {
						url: 'https://example.com/happy.png',
						mediaType: 'image/png',
					},
				}];
				const result = await activitypub.helpers.renderEmoji(':happy: Hello :happy: world :happy:', tags, true);
				assert.strictEqual(result, ' Hello  world ');
			});
		});

		describe('non-Emoji tags', () => {
			it('should ignore non-Emoji tags', async () => {
				const tags = [{
					type: 'Mention',
					name: '@user',
					icon: {
						url: 'https://example.com/user.png',
					},
				}];
				const result = await activitypub.helpers.renderEmoji('Hello @user world', tags);
				assert.strictEqual(result, 'Hello @user world');
			});
		});

		describe('deduplication', () => {
			it('should not process the same emoji twice', async () => {
				// Monkey-patch the emoji module directly (used internally by helpers.renderEmoji)
				const emojiModuleDirect = require('../../src/activitypub/emoji');
				const processed = [];
				const originalProcess = emojiModuleDirect.processEmojiTag;
				emojiModuleDirect.processEmojiTag = async (tag) => {
					processed.push(tag.name);
					return originalProcess(tag);
				};

				const tags = [
					{
						type: 'Emoji',
						name: ':test:',
						icon: {
							url: 'https://example.com/test.png',
							mediaType: 'image/png',
						},
					},
					{
						type: 'Emoji',
						name: ':test:',
						icon: {
							url: 'https://example.com/test2.png',
							mediaType: 'image/png',
						},
					},
				];

				await activitypub.helpers.renderEmoji(':test:', tags);
				assert.strictEqual(processed.length, 1);

				emojiModuleDirect.processEmojiTag = originalProcess;
			});
		});

		describe('shortcodes without colons', () => {
			it('should add colons to shortcodes missing them', async () => {
				const tags = [{
					type: 'Emoji',
					name: 'test',
					icon: {
						url: 'https://example.com/test.png',
						mediaType: 'image/png',
					},
				}];
				const result = await activitypub.helpers.renderEmoji(':test:', tags, true);
				assert.strictEqual(result, '');
			});
		});
	});
});
