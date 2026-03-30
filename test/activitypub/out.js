'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const meta = require('../../src/meta');
const install = require('../../src/install');
const utils = require('../../src/utils');
const activitypub = require('../../src/activitypub');

const helpers = require('./helpers');

describe('Outbound activities module', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

	describe('.announce', () => {
		function commonTests() {
			it('should not error when called', async function () {
				await activitypub.out.announce.topic(this.tid, this.uid);
				const { payload, targets } = Array.from(activitypub._sent).pop()[1];
				this.payload = payload;
				this.targets = targets;
			});

			it('should send an Announce activity', function () {
				assert.strictEqual(activitypub._sent.size, 1);
				assert.strictEqual(this.payload.type, 'Announce');
			});

			it('should contain the main post\'s pid in object', function () {
				assert.strictEqual(this.payload.object, this.pid);
			});

			it('should have actor as the calling user or category as appropriate', function () {
				if (this.uid) {
					assert.strictEqual(this.payload.actor, `${nconf.get('url')}/uid/${this.uid}`);
				} else {
					assert.strictEqual(this.payload.actor, `${nconf.get('url')}/category/${this.cid}`);
				}
			});
		}

		describe('.topic() (remote topic; by cid)', () => {
			before(async function () {
				const { id: pid, note } = helpers.mocks.note();
				const { cid } = await categories.create({ name: utils.generateUUID() });
				await activitypub.notes.assert(0, pid, { skipChecks: 1, cid });

				this.pid = pid;
				this.note = note;
				this.cid = cid;
				this.tid = await posts.getPostField(pid, 'tid');
			});

			after(() => {
				activitypub._sent.clear();
			});

			commonTests();

			it('should include the category\'s followers collection in cc', function () {
				assert(this.payload.cc.includes(`${nconf.get('url')}/category/${this.cid}/followers`));
			});

			it('should include the author in cc', function () {
				assert(this.payload.cc.includes(this.note.attributedTo));
			});

			it('should include the author in targets', function () {
				assert(this.targets.includes(this.note.attributedTo));
			});
		});

		describe('.topic() (local topic; by cid)', () => {
			before(async function () {
				const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const { cid } = await categories.create({ name: utils.generateUUID() });
				const { postData, topicData } = await topics.post({
					cid, uid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});

				this.tid = topicData.tid;
				this.cid = cid;
				this.pid = `${nconf.get('url')}/post/${topicData.mainPid}`;
				this.note = await activitypub.mocks.notes.public(postData);
			});

			after(() => {
				activitypub._sent.clear();
			});

			commonTests();

			it('should include the topic\'s mainPid in object', async function () {
				const mainPid = await topics.getTopicField(this.tid, 'mainPid');
				assert.strictEqual(this.payload.object, `${nconf.get('url')}/post/${mainPid}`);
			});
		});

		describe('.topic() (remote topic; by uid)', () => {
			before(async function () {
				const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const { id: pid, note } = helpers.mocks.note();

				await activitypub.notes.assert(0, pid, { skipChecks: 1 });

				this.pid = pid;
				this.note = note;
				this.tid = await posts.getPostField(pid, 'tid');
				this.uid = uid;
			});

			after(() => {
				activitypub._sent.clear();
			});

			commonTests();
		});

		describe('.topic() (local topic; by uid)', () => {
			before(async function () {
				const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const { cid } = await categories.create({ name: utils.generateUUID() });
				const { postData, topicData } = await topics.post({
					cid, uid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});

				this.tid = topicData.tid;
				this.cid = cid;
				this.pid = `${nconf.get('url')}/post/${topicData.mainPid}`;
				this.note = await activitypub.mocks.notes.public(postData);
				this.uid = uid;
			});

			after(() => {
				activitypub._sent.clear();
			});

			commonTests();
		});
	});
});