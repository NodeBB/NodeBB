'use strict';

const assert = require('assert');
const nconf = require('nconf');
const path = require('path');

const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');
const plugins = require('../../src/plugins');

describe('Mocking', () => {
	describe('Outbound (local content to AP object)', () => {
		describe('Notes', () => {
			describe('.public()', () => {
				before(async function () {
					const { cid } = await categories.create({ name: utils.generateUUID() });
					this.cid = cid;
					this.uid = await user.create({ username: utils.generateUUID() });

					let { postData } = await topics.post({
						cid,
						uid: this.uid,
						content: utils.generateUUID(),
					});
					this.note = await activitypub.mocks.notes.public(postData);

					({ postData } = await topics.post({
						cid,
						uid: this.uid,
						title: utils.generateUUID(),
						content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\
							Aliquam vel augue, id luctus nulla. Mauris efficitur blandit neque et mattis.\
							Etiam sodales et ipsum et ultricies. Nam non velit id arcu vestibulum suscipit.\
							Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.\
							Integer dui elit, placerat vitae porta in, euismod eu mi.\
							Curabitur eget lorem dapibus, accumsan leo in, gravida magna.\
							Donec fringilla rhoncus eros, eget auctor lectus imperdiet vitae. Nullam vitae urna leo.\
							Curabitur eu viverra libero, vel malesuada lorem. Praesent condimentum eu felis nec tincidunt.\
							Morbi nisl lorem, facilisis sed lorem at, venenatis. ',
					}));
					this.article = await activitypub.mocks.notes.public(postData);

					({ postData } = await topics.post({
						cid,
						uid: this.uid,
						title: utils.generateUUID(),
						content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\
							Aliquam vel augue, id luctus nulla. Mauris efficitur blandit neque et mattis. [...]\
							Etiam sodales et ipsum et ultricies. Nam non velit id arcu vestibulum suscipit.\
							Curabitur eget lorem dapibus, accumsan leo in, gravida magna.\
							Donec fringilla rhoncus eros, eget auctor lectus imperdiet vitae. Nullam vitae urna leo.\
							Curabitur eu viverra libero, vel malesuada lorem. Praesent condimentum eu felis nec tincidunt.\
							Morbi nisl lorem, facilisis sed lorem at, venenatis. ',
					}));
					this.withBreakPost = postData;
					this.withBreak = await activitypub.mocks.notes.public(postData);
				});

				it('should report an OP with < 500 characters as a type Note', function () {
					assert.strictEqual(this.note.type, 'Note');
				});

				it('should set a summary that is 500 characters or less', function () {
					assert(this.article.summary.length < 500);
				});

				it('should end the summary with "[...]" if truncation happened', function () {
					assert(this.article.summary.endsWith, '[...]');
				});

				it('should set a summary that contains everything before the magic break string (if one is set)', function () {
					assert.strictEqual(this.withBreak.summary, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\
							Aliquam vel augue, id luctus nulla. Mauris efficitur blandit neque et mattis. [...]');
				});

				it('should not contain the magic break string when content is parsed normally', async function () {
					const clone = { ...this.withBreakPost };
					const { content } = await posts.parsePost(clone);
					assert(!content.includes('[...]'));
				});

				describe('Altered magic break string', () => {
					let string;
					before(() => {
						string = meta.config.activitypubBreakString;
						meta.config.activitypubBreakString = 'Mauris';
					});

					after(() => {
						meta.config.activitypubBreakString = string;
					});

					it('should work with a customized break string', async function () {
						const mocked = await activitypub.mocks.notes.public(this.withBreakPost);
						assert.strictEqual(mocked.summary, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\
							Aliquam vel augue, id luctus nulla. Mauris');
					});
				});

				describe('Altered summary limit', () => {
					let string;
					let limit;
					before(() => {
						string = meta.config.activitypubBreakString;
						meta.config.activitypubBreakString = 'lkjsdnfkjsdfkjsdhfkd';
						limit = meta.config.activitypubSummaryLimit;
						meta.config.activitypubSummaryLimit = 60;
					});

					after(() => {
						meta.config.activitypubBreakString = string;
						meta.config.activitypubSummaryLimit = limit;
					});

					it('should work with a customized summary limit', async function () {
						const mocked = await activitypub.mocks.notes.public(this.withBreakPost);
						assert.strictEqual(mocked.summary, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. [...]');
					});
				});

				describe('Type Determination', () => {
					let postDataWithGeneratedTitle;
					let postDataWithoutGeneratedTitle;

					before(async function () {
						const { cid } = await categories.create({ name: utils.generateUUID() });
						this.cid = cid;
						this.uid = await user.create({ username: utils.generateUUID() });

						// Create post with generated title (should be Note type)
						({ postData: postDataWithGeneratedTitle } = await topics.post({
							cid,
							uid: this.uid,
							content: 'Short content',
						}));

						// Create post without generated title (should be Article type)
						({ postData: postDataWithoutGeneratedTitle } = await topics.post({
							cid,
							uid: this.uid,
							title: utils.generateUUID(),
							content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
									'Aliquam vel augue, id luctus nulla. Mauris efficitur blandit neque et mattis. ' +
									'Etiam sodales et ipsum et ultricies. Nam non velit id arcu vestibulum suscipit. ' +
									'Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. ' +
									'Integer dui elit, placerat vitae porta in, euismod eu mi. Curabitur eget lorem dapibus, ' +
									'accumsan leo in, gravida magna. Donec fringilla rhoncus eros, eget auctor lectus imperdiet vitae. ' +
									'Nullam vitae urna leo. Curabitur eu viverra libero, vel malesuada lorem. Praesent condimentum eu felis nec tincidunt. ' +
									'Morbi nisl lorem, facilisis sed lorem at, venenatis.',
						}));
					});

					it('should return type "Note" when generatedTitle is true', async function () {
						const result = await activitypub.mocks.notes.public(postDataWithGeneratedTitle);
						assert.strictEqual(result.type, 'Note');
					});

					it('should return type "Article" when generatedTitle is false', async function () {
						const result = await activitypub.mocks.notes.public(postDataWithoutGeneratedTitle);
						assert.strictEqual(result.type, 'Article');
					});

					it('should return type "Article" for short content even when generatedTitle is false (averting legacy behavior)', async function () {
						// Old behaviour classified short posts < 500 chars (later configurable) as Notes even if titled.
						const shortPostData = await topics.post({
							cid: this.cid,
							uid: this.uid,
							title: utils.generateUUID(),
							content: 'Short content',
						});

						const result = await activitypub.mocks.notes.public(shortPostData.postData);
						assert.strictEqual(result.type, 'Article');
					});
				});

				describe('Mentions', () => {
					let mentionUid;
					let mentionPlugin;
					let originalIsActive;

					before(async function () {
						const { cid } = await categories.create({ name: utils.generateUUID() });
						this.cid = cid;

						// Create a user to mention
						mentionUid = await user.create({ username: utils.generateUUID().slice(0, 8) });

						// Mock the mentions plugin as active
						originalIsActive = plugins.isActive;
						plugins.isActive = (name, callback) => {
							if (name === 'nodebb-plugin-mentions') {
								if (typeof callback === 'function') {
									callback(null, true);
								} else {
									return Promise.resolve(true);
								}
							} else {
								return originalIsActive(name, callback);
							}
						};
						plugins.isActive.toString = () => originalIsActive.toString();

						// Mock the mentions plugin's getMatches
						const mentionPath = path.join(__dirname, '../../node_modules/nodebb-plugin-mentions');
						mentionPlugin = nodebb.require(mentionPath);
						mentionPlugin.getMatches = async (content) => {
							const matches = new Set();
							// Simple regex to find @username mentions
							const mentionRegex = /@([a-zA-Z0-9_]+)/g;
							let match;
							while ((match = mentionRegex.exec(content)) !== null) {
								const username = match[1].toLowerCase();
								if (username === mentionPlugin.targetUsername) {
									matches.add({
										type: 'uid',
										id: mentionPlugin.targetUid,
										slug: `@${username}`,
									});
								}
							}
							return matches;
						};
					});

					after(() => {
						plugins.isActive = originalIsActive;
					});

					beforeEach(() => {
						mentionPlugin.targetUsername = null;
						mentionPlugin.targetUid = null;
					});

					it('should generate correct /uid/{uid} href for local user mentions', async function () {
						// Set the target username/uid for the mock
						const userData = await user.getUserData(mentionUid);
						mentionPlugin.targetUsername = userData.username;
						mentionPlugin.targetUid = mentionUid;

						const { cid, uid } = this;
						const mentionContent = `Hello @${userData.username}, this is a test post.`;

						const { postData } = await topics.post({
							cid,
							uid,
							content: mentionContent,
						});

						const result = await activitypub.mocks.notes.public(postData);

						assert(Array.isArray(result.tag), 'result.tag should be an array');

						const mentionTag = result.tag.find(
							(tag) => tag.type === 'Mention' && tag.href.includes('/uid/')
						);
						assert(mentionTag, 'Should have a mention tag with /uid/ href');
						assert.strictEqual(
							mentionTag.href,
							`${nconf.get('url')}/uid/${mentionUid}`,
							'Mention href should use /uid/{uid} format'
						);
					});

					it('should generate correct /category/{cid} href for local category mentions', async function () {
						// Create a category to mention
						const { cid: mentionCid } = await categories.create({ name: utils.generateUUID() });

						// Set up the mock for a category mention
						mentionPlugin.getMatches = async (content) => {
							const matches = new Set();
							const mentionRegex = /@([a-zA-Z0-9_]+)/g;
							let match;
							while ((match = mentionRegex.exec(content)) !== null) {
								const slug = match[1].toLowerCase();
								matches.add({
									type: 'cid',
									id: mentionCid,
									slug: `@${slug}`,
								});
							}
							return matches;
						};

						const { cid, uid } = this;
						const mentionContent = `Hello @testcategory, this is a test post.`;

						const { postData } = await topics.post({
							cid,
							uid,
							content: mentionContent,
						});

						const result = await activitypub.mocks.notes.public(postData);

						assert(Array.isArray(result.tag), 'result.tag should be an array');

						const categoryMentionTag = result.tag.find(
							(tag) => tag.type === 'Mention' && tag.href.includes('/category/')
						);
						assert(categoryMentionTag, 'Should have a category mention tag with /category/ href');
						assert.strictEqual(
							categoryMentionTag.href,
							`${nconf.get('url')}/category/${mentionCid}`,
							'Category mention href should use /category/{cid} format'
						);
					});
				});
			});
		});
	});
});
