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
		describe('.topic() (remote topic; by cid)', () => {
			let pid;
			let note;
			let tid;
			let cid;

			before(async () => {
				({ id: pid, note } = helpers.mocks.note());
				({ cid } = await categories.create({ name: utils.generateUUID() }));
				await activitypub.notes.assert(0, pid, { skipChecks: 1, cid });
				tid = await posts.getPostField(pid, 'tid');
			});

			after(() => {
				activitypub._sent.clear();
			});

			it('should not error when called', async () => {
				await activitypub.out.announce.topic(tid);
			});

			it('should send an Announce activity', () => {
				assert.strictEqual(activitypub._sent.size, 1);

				const { payload } = Array.from(activitypub._sent).pop()[1];
				assert.strictEqual(payload.type, 'Announce');
			});

			it('should contain the main post\'s pid in object', () => {
				const { payload } = Array.from(activitypub._sent).pop()[1];
				assert.strictEqual(payload.object, pid);
			});

			it('should include the category\'s followers collection in cc', () => {
				const { payload } = Array.from(activitypub._sent).pop()[1];
				assert(payload.cc.includes(`${nconf.get('url')}/category/${cid}/followers`));
			});

			it('should include the author in cc', () => {
				const { payload } = Array.from(activitypub._sent).pop()[1];
				assert(payload.cc.includes(note.attributedTo));
			});

			it('should include the author in targets', () => {
				const { targets } = Array.from(activitypub._sent).pop()[1];
				assert(targets.includes(note.attributedTo));
			});
		});

		describe('.topic() (local topic; by cid)', () => {
			let uid;
			let tid;
			let cid;

			before(async () => {
				uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				({ cid } = await categories.create({ name: utils.generateUUID() }));
				const { topicData } = await topics.post({
					cid, uid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});
				({ tid } = topicData);
			});

			after(() => {
				activitypub._sent.clear();
			});

			it('should not error when called', async () => {
				await activitypub.out.announce.topic(tid);
			});

			it('should include the topic\'s mainPid in object', async () => {
				const mainPid = await topics.getTopicField(tid, 'mainPid');
				const { payload } = Array.from(activitypub._sent).pop()[1];
				assert.strictEqual(payload.object, `${nconf.get('url')}/post/${mainPid}`);
			});
		});
	});
});