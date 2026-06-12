'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');

const meta = require('../../src/meta');
const plugins = require('../../src/plugins');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const user = require('../../src/user');

describe('Topic Events', () => {
	let fooUid;
	let topic;
	before(async () => {
		fooUid = await user.create({ username: 'foo', password: '123456' });

		const categoryObj = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		});
		topic = await topics.post({
			title: 'topic events testing',
			content: 'foobar one two three',
			uid: fooUid,
			cid: 1,
		});
	});

	describe('.init()', () => {
		before(() => {
			topics.events._ready = false;
		});

		it('should allow a plugin to expose new event types', async () => {
			await plugins.hooks.register('core', {
				hook: 'filter:topicEvents.init',
				method: async ({ types }) => {
					types.foo = {
						icon: 'bar',
						text: 'baz',
						quux: 'quux',
					};

					return { types };
				},
			});

			await topics.events.init();

			assert(topics.events._types.foo);
			assert.deepStrictEqual(topics.events._types.foo, {
				icon: 'bar',
				text: 'baz',
				quux: 'quux',
			});
		});
	});

	describe('.log()', () => {
		it('should log and return a set of new events in the topic', async () => {
			const events = await topics.events.log(topic.topicData.tid, {
				type: 'foo',
			});

			assert(events);
			assert(Array.isArray(events));
			events.forEach((event) => {
				assert(['id', 'icon', 'text', 'timestamp', 'timestampISO', 'type', 'quux'].every(key => event.hasOwnProperty(key)));
			});
		});
	});

	describe('.get()', () => {
		it('should get a topic\'s events', async () => {
			const events = await topics.events.get(topic.topicData.tid);

			assert(events);
			assert(Array.isArray(events));
			assert.strictEqual(events.length, 1);
			events.forEach((event) => {
				assert(['id', 'icon', 'text', 'timestamp', 'timestampISO', 'type', 'quux'].every(key => event.hasOwnProperty(key)));
			});
		});
	});

	describe('.purge()', () => {
		let eventIds;

		before(async () => {
			const events = await topics.events.get(topic.topicData.tid);
			eventIds = events.map(event => event.id);
		});

		it('should purge topic\'s events from the database', async () => {
			await topics.events.purge(topic.topicData.tid);

			const keys = [`topic:${topic.topicData.tid}:events`];
			keys.push(...eventIds.map(id => `topicEvent:${id}`));

			const exists = await Promise.all(keys.map(key => db.exists(key)));
			assert(exists.every(exists => !exists));
		});
	});

	it('should properly escape topic events with HTML and tx tokens in their arguments', async () => {
		const oldVlaueShowFullnameAsDisplayName = meta.config.showFullnameAsDisplayName;
		meta.config.showFullnameAsDisplayName = 1;
		const { topicData } = await topics.post({
			title: 'topic events testing',
			content: 'foobar one two three',
			uid: fooUid,
			cid: 1,
		});
		const uid = await user.create({ username: 'bar', fullname: '"><script>alert("xss")</script> [[global:posts]]' });
		await user.setSetting(uid, 'showfullname', 1);

		const now = Date.now();
		await topics.events.log(topicData.tid, {
			uid: uid,
			type: 'fork',
			href: `/topic/${topicData.tid}`,
			timestamp: now,
		});

		const events = await topics.events.get(topicData.tid, uid);

		assert.deepStrictEqual(events[0].text, `<span title="&quot;&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &lsqb;&lsqb;global:posts&rsqb;&rsqb;" data-uid="2" class="avatar avatar-rounded" component="avatar/icon" style="--avatar-size: 16px; background-color: #827717">B</span> <a href="/user/bar">&quot;&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt; &lsqb;&lsqb;global:posts&rsqb;&rsqb;</a> <a href="/topic/2">forked</a> this topic <span class="timeago timeline-text" title="${new Date(now).toISOString()}"></span>`);

		meta.config.showFullnameAsDisplayName = oldVlaueShowFullnameAsDisplayName;
	});
});
