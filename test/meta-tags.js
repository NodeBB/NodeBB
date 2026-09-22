'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const topics = require('../src/topics');
const categories = require('../src/categories');
const User = require('../src/user');
const plugins = require('../src/plugins');
const request = require('../src/request');

describe('meta tags (custom global tags)', () => {
	let adminUid;
	let category;
	let topic;

	before(async () => {
		adminUid = await User.create({ username: 'admin', password: '123456' });
		category = await categories.create({ name: 'Meta Tags Test', description: 'test' });
		({ topicData: topic } = await topics.post({
			uid: adminUid,
			title: 'My Test Topic',
			content: 'topic content',
			cid: category.cid,
		}));
	});

	after(async () => {
		await setMetaTags({});
	});

	async function getTopicHtml() {
		const { body } = await request.get(`${nconf.get('url')}/topic/${topic.slug}`);
		return body;
	}

	function countMatches(html, str) {
		return html.split(str).length - 1;
	}

	// Mirrors the admin.settings.set socket (full-form save clears stale fields)
	async function setMetaTags(values) {
		await meta.settings.set('metaTags', values, false, true);
	}

	it('should add custom global meta tags to a page', async () => {
		await setMetaTags({
			'og:custom:prop': 'Custom Prop Value',
			'twitter:card': 'summary_large_image',
		});

		const html = await getTopicHtml();
		assert(html.includes('<meta property="og:custom:prop" content="Custom Prop Value" />'));
		assert(html.includes('<meta name="twitter:card" content="summary_large_image" />'));
	});

	it('should use property for og: keys and name for everything else', async () => {
		await setMetaTags({
			'og:locale': 'en_GB',
			'twitter:site': '@nodebb',
			description: 'A custom description',
		});

		const html = await getTopicHtml();
		// og: keys use the `property` attribute
		assert(html.includes('<meta property="og:locale" content="en_GB" />'));
		assert(!html.includes('name="og:locale"'));
		// non-og keys use the `name` attribute
		assert(html.includes('<meta name="twitter:site" content="@nodebb" />'));
		assert(!html.includes('property="twitter:site"'));
	});

	it('should allow plugins to modify custom tags via filter:meta.getMetaTags', async () => {
		await setMetaTags({
			'twitter:card': 'summary',
		});

		plugins.hooks.register('meta-tags-test', {
			hook: 'filter:meta.getMetaTags',
			method: async (context) => {
				context.tags = context.tags.filter(tag => !(tag.name === 'twitter:card'));
				context.tags.push({ name: 'twitter:card', content: 'summary_large_image' });
				return context;
			},
		});

		try {
			const html = await getTopicHtml();
			assert(!html.includes('<meta name="twitter:card" content="summary" />'));
			assert(html.includes('<meta name="twitter:card" content="summary_large_image" />'));
		} finally {
			plugins.hooks.unregister('meta-tags-test', 'filter:meta.getMetaTags');
		}
	});

	it('should let page-specific tags win over custom tags (no duplicates)', async () => {
		await setMetaTags({
			'og:title': 'Global OG Title',
		});

		const html = await getTopicHtml();
		// Only one og:title, and it is the page-specific (topic title) one
		assert.strictEqual(countMatches(html, 'property="og:title"'), 1);
		assert(html.includes('<meta property="og:title" content="My Test Topic" />'));
		assert(!html.includes('content="Global OG Title"'));
	});

	it('should skip tags with empty content', async () => {
		await setMetaTags({
			'twitter:card': 'summary',
			'og:locale': '',
		});

		const html = await getTopicHtml();
		assert(html.includes('<meta name="twitter:card" content="summary" />'));
		assert(!html.includes('property="og:locale"'));
	});

	it('should add no custom tags when none are set', async () => {
		await setMetaTags({});

		const html = await getTopicHtml();
		assert(!html.includes('name="twitter:card"'));
		assert(!html.includes('property="og:custom:prop"'));
		// Core defaults still present
		assert(html.includes('property="og:site_name"'));
	});

	it('should not include custom tags in API responses', async () => {
		await setMetaTags({
			'twitter:card': 'summary_large_image',
		});

		const { body } = await request.get(`${nconf.get('url')}/api/topic/${topic.slug}`);
		assert(!JSON.stringify(body).includes('twitter:card'));
	});
});
