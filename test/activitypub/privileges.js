'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const request = require('../../src/request');
const user = require('../../src/user');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const categories = require('../../src/categories');
const privileges = require('../../src/privileges');
const meta = require('../../src/meta');
const install = require('../../src/install');
const utils = require('../../src/utils');
const activitypub = require('../../src/activitypub');

const helpers = require('./helpers');

describe('Privilege logic for remote users/content (ActivityPub)', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		// await install.giveWorldPrivileges();
	});

	describe('"fediverse" pseudo-user', () => {
		describe('no privileges given', () => {
			let uid;
			let cid;
			let topicData;
			let postData;
			let mainPid;
			let handle;

			before(async () => {
				uid = await user.create({ username: utils.generateUUID() });
				({ cid } = await categories.create({ name: utils.generateUUID() }));
				({ topicData, postData } = await topics.post({
					cid,
					uid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				}));
				handle = await categories.getCategoryField(cid, 'handle');
				const privsToRemove = await privileges.categories.getGroupPrivilegeList();
				await privileges.categories.rescind(privsToRemove, cid, ['fediverse']);
			});

			describe('incoming requests', () => {
				it('should not respond to a webfinger request to a category\'s handle', async () => {
					const response = await activitypub.helpers.query(`${handle}@${nconf.get('url_parsed').hostname}`);
					assert.strictEqual(response, false);
				});

				it('should not respond to a request for the category actor', async () => {
					await assert.rejects(
						activitypub.get('uid', uid, `${nconf.get('url')}/category/${cid}`),
						{ message: '[[error:activitypub.get-failed]]' }
					);
				});

				it('should not respond to a request for a topic collection', async () => {
					await assert.rejects(
						activitypub.get('uid', uid, `${nconf.get('url')}/topic/${topicData.tid}`),
						{ message: '[[error:activitypub.get-failed]]' }
					);
				});

				it('should not respond to a request for a post', async () => {
					await assert.rejects(
						activitypub.get('uid', uid, `${nconf.get('url')}/post/${topicData.mainPid}`),
						{ message: '[[error:activitypub.get-failed]]' }
					);
				});
			});

			describe('incoming activities', () => {
				describe('Create(Note)', () => {
					let note;
					let activity;

					before(async () => {
						({ note } = helpers.mocks.note({
							cc: [`${nconf.get('url')}/category/${cid}`],
						}));
						({ activity } = helpers.mocks.create(note));
						await activitypub.inbox.create({ body: activity });
					});

					it('should not assert the note', async () => {
						const exists = await posts.exists(note.id);
						assert.strictEqual(exists, false);
					});
				});

				describe('Update(Note)', () => {
					let note;
					let activity;

					before(async () => {
						({ note } = helpers.mocks.note({
							cc: [`${nconf.get('url')}/category/${cid}`],
						}));
						({ activity } = helpers.mocks.create(note));
						await privileges.categories.give(['groups:topics:create'], cid, ['fediverse']);
						await activitypub.inbox.create({ body: activity });
					});

					after(async () => {
						await privileges.categories.rescind(['groups:topics:create'], cid, ['fediverse']);
					});

					it('should assert the note', async () => {
						const exists = await posts.exists(note.id);
						assert.strictEqual(exists, true);
					});

					it('should not allow edits to the note', async () => {
						const oldContent = note.content;
						note.content = 'new content';
						({ activity } = helpers.mocks.update({
							object: note,
						}));

						await activitypub.inbox.update({ body: activity });

						const postData = await posts.getPostData(note.id);
						assert.strictEqual(postData.content, oldContent);
						assert.strictEqual(postData.edited, 0);
					});
				});

				describe('Delete(Note)', () => {
					let note;
					let activity;

					before(async () => {
						({ note } = helpers.mocks.note({
							cc: [`${nconf.get('url')}/category/${cid}`],
						}));
						({ activity } = helpers.mocks.create(note));
						await privileges.categories.give(['groups:topics:create'], cid, ['fediverse']);
						await activitypub.inbox.create({ body: activity });
					});

					after(async () => {
						await privileges.categories.rescind(['groups:topics:create'], cid, ['fediverse']);
					});

					it('should assert the note', async () => {
						const exists = await posts.exists(note.id);
						assert.strictEqual(exists, true);
					});

					it('should ignore remote deletion of said note', async () => {
						({ activity } = helpers.mocks.delete({ object: note }));
						await activitypub.inbox.delete({ body: activity });

						const exists = await posts.exists(note.id);
						assert.strictEqual(exists, true);
					});
				});
			});

			describe('outgoing requests', () => {
				it('should not federate out a new post', async () => {

				});

				it('should not federate out a post edit', async () => {

				});

				it('should not federate out a post deletion', async () => {

				});

				it('should not federate out a post announce', async () => {

				});
			});
		});

		describe('regular privilege set', () => {
			let cid;
			let handle;

			before(async () => {
				({ cid } = await categories.create({ name: utils.generateUUID() }));
				handle = await categories.getCategoryField(cid, 'handle');
				const privsToRemove = await privileges.categories.getGroupPrivilegeList();
			});

			describe('groups:find', () => {
				it('should return webfinger response to a category\'s handle', async () => {
					const { response, body } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct:${handle}@${nconf.get('url_parsed').host}`);

					assert(response);
					assert.strictEqual(response.statusCode, 200);
					assert(body.links && body.links.length);
					assert.strictEqual(body.subject, `acct:${handle}@${nconf.get('url_parsed').host}`);
				});
			});
		});
	});
});