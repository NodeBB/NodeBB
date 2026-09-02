'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');
const activitypub = require('../../src/activitypub');
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
			assert.ok(result.localPath.endsWith('emoji/ap/mastodon.social/poop.png'));
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
