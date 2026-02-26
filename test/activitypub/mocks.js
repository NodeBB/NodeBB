'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');

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
						title: utils.generateUUID(),
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
			});
		});
	});
});