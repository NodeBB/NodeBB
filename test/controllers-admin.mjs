import assert from 'assert';
import async from 'async';
import nconf from 'nconf';
import fs from 'fs/promises';

import './mocks/databasemock.mjs';
import request from '../src/request.js';
import categories from '../src/categories/index.js';
import topics from '../src/topics/index.js';
import user from '../src/user/index.js';
import groups from '../src/groups/index.js';
import helpers from './helpers/index.js';
import meta from '../src/meta/index.js';
import privileges from '../src/privileges/index.js';
import plugins from '../src/plugins/index.js';
import navigation from '../src/navigation/admin.js';

describe('Admin Controllers', () => {
	let tid;
	let cid;
	let pid;
	let regularPid;
	let adminUid;
	let regularUid;
	let regular2Uid;
	let moderatorUid;
	let jar;

	before(async () => {
		const results = await new Promise((resolve, reject) => {
			async.series(
				{
					category: next => categories.create({ name: 'Test Category', description: 'Test category created by testing script' }, next),
					adminUid: next => user.create({ username: 'admin', password: 'barbar' }, next),
					regularUid: next => user.create({ username: 'regular', password: 'regularpwd' }, next),
					regular2Uid: next => user.create({ username: 'regular2' }, next),
					moderatorUid: next => user.create({ username: 'moderator', password: 'modmod' }, next),
				},
				(err, results) => {
					if (err) reject(err);
					else resolve(results);
				}
			);
		});

		adminUid = results.adminUid;
		regularUid = results.regularUid;
		regular2Uid = results.regular2Uid;
		moderatorUid = results.moderatorUid;
		cid = results.category.cid;

		const adminPost = await topics.post({
			uid: adminUid,
			title: 'test topic title',
			content: 'test topic content',
			cid: results.category.cid,
		});
		tid = adminPost.topicData.tid;
		pid = adminPost.postData.pid;

		const regularPost = await topics.post({
			uid: regular2Uid,
			title: "regular user's test topic title",
			content: 'test topic content',
			cid: results.category.cid,
		});
		regularPid = regularPost.postData.pid;
	});

	it('should 403 if user is not admin', async () => {
		({ jar } = await helpers.loginUser('admin', 'barbar'));
		const { response, body } = await request.get(`${nconf.get('url')}/admin`, { jar });
		assert.equal(response.statusCode, 403);
		assert(body);
	});

	it('should load admin dashboard', async () => {
		await groups.join('administrators', adminUid);
		const today = new Date();
		const end = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
		today.setDate(today.getDate() - 1);
		const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

		const dashboards = [
			'/admin',
			'/admin/dashboard/logins',
			'/admin/dashboard/users',
			'/admin/dashboard/topics',
			'/admin/dashboard/searches',
			`/admin/dashboard/searches?start=${start}&end=${end}`,
		];

		for (const url of dashboards) {
			const { response, body } = await request.get(`${nconf.get('url')}${url}`, { jar });
			assert.equal(response.statusCode, 200, url);
			assert(body);
		}
	});

	it('should load admin analytics', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/analytics?units=hours`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
		assert(body.query);
		assert(body.result);
	});

	it('should load groups page', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/manage/groups`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load groups detail page', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/manage/groups/administrators`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load global privileges page', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/manage/privileges`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load admin privileges page', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/manage/privileges/admin`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load privileges page for category 1', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/manage/privileges/1`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load manage digests', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/manage/digest`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load manage uploads', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/manage/uploads`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load general settings page', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/settings/general`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load email settings page', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/settings/email`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load user settings page', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/admin/settings/user`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load info page for a user', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/user/regular/info`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body.history);
		assert(Array.isArray(body.history.flags));
		assert(Array.isArray(body.history.bans));
		assert(Array.isArray(body.sessions));
	});

	it('should 404 for edit/email page if user does not exist', async () => {
		const { response } = await request.get(`${nconf.get('url')}/api/user/doesnotexist/edit/email`, { jar });
		assert.equal(response.statusCode, 404);
	});

	it('should load /admin/settings/homepage', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/settings/general`, { jar, json: true });
		assert.equal(response.statusCode, 200);
		assert(body.routes);
	});

	it('should load /admin/advanced/database', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/database`, { jar, json: true });
		assert.equal(response.statusCode, 200);

		if (nconf.get('redis')) {
			assert(body.redis);
		} else if (nconf.get('mongo')) {
			assert(body.mongo);
		} else if (nconf.get('postgres')) {
			assert(body.postgres);
		}
	});

	it('should load /admin/extend/plugins', async function () {
		this.timeout(50000);
		const { body } = await request.get(`${nconf.get('url')}/api/admin/extend/plugins`, { jar });
		assert(body.hasOwnProperty('installed'));
		assert(body.hasOwnProperty('upgradeCount'));
		assert(body.hasOwnProperty('download'));
		assert(body.hasOwnProperty('incompatible'));
	});

	it('should load /admin/manage/users', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/users`, { jar, json: true });
		assert.strictEqual(response.statusCode, 200);
		assert(body);
		assert(body.users.length > 0);
	});

	it('should load /admin/manage/users?filters=banned', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/users?filters=banned`, { jar, json: true });
		assert.strictEqual(response.statusCode, 200);
		assert(body);
		assert.strictEqual(body.users.length, 0);
	});

	it('should load /admin/manage/users?filters=banned&filters=verified', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/users?filters=banned&filters=verified`, { jar, json: true });
		assert.strictEqual(response.statusCode, 200);
		assert(body);
		assert.strictEqual(body.users.length, 0);
	});

	it('should load /admin/manage/users?query=admin', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/users?query=admin`, { jar, json: true });
		assert.strictEqual(response.statusCode, 200);
		assert(body);
		assert.strictEqual(body.users[0].username, 'admin');
	});

	it('should return empty results if query is too short', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/users?query=a`, { jar });
		assert.strictEqual(response.statusCode, 200);
		assert(body);
		assert.strictEqual(body.users.length, 0);
	});

	it('should load /admin/manage/registration', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/registration`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should 404 if users is not privileged', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/registration-queue`);
		assert.equal(response.statusCode, 404);
		assert(body);
	});

	it('should load /api/registration-queue', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/registration-queue`, { jar, json: true });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/manage/admins-mods', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/admins-mods`, { jar, json: true });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/users/csv', async () => {
		const socketAdmin = await import('../src/socket.io/admin.js');
		await new Promise((resolve, reject) => {
			socketAdmin.default.user.exportUsersCSV({ uid: adminUid }, {}, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		await new Promise(resolve => setTimeout(resolve, 2000));

		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/users/csv`, {
			jar,
			headers: {
				referer: `${nconf.get('url')}/admin/manage/users`,
			},
		});
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should return 403 if no referer', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/groups/administrators/csv`, { jar });
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:invalid-origin]]');
	});

	it('should return 403 if referer is not /api/admin/groups/administrators/csv', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/groups/administrators/csv`, {
			jar,
			headers: {
				referer: '/topic/1/test',
			},
		});
		assert.equal(response.statusCode, 403);
		assert.equal(body, '[[error:invalid-origin]]');
	});

	it('should load /api/admin/groups/administrators/csv', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/groups/administrators/csv`, {
			jar,
			headers: {
				referer: `${nconf.get('url')}/admin/manage/groups`,
			},
		});
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/advanced/hooks', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/hooks`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/advanced/cache', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/cache`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /api/admin/advanced/cache/dump and 404 with no query param', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/cache/dump`, { jar });
		assert.equal(response.statusCode, 404);
		assert(body);
	});

	it('should load /api/admin/advanced/cache/dump', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/cache/dump?name=post`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/advanced/errors', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/errors`, { jar, json: true });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/advanced/errors/export', async () => {
		await meta.errors.clear();
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/errors/export`, { jar });
		assert.equal(response.statusCode, 200);
		assert.strictEqual(body, '');
	});

	it('should load /admin/advanced/logs', async () => {
		await fs.appendFile(meta.logs.path, 'dummy log');
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/logs`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/settings/navigation', async () => {
		const data = await import('../install/data/navigation.json', { with: { type: 'json' } });
		await navigation.save(data.default);

		const { body } = await request.get(`${nconf.get('url')}/api/admin/settings/navigation`, { jar });
		assert(body);
		assert(body.available);
		assert(body.enabled);
	});

	it('should load /admin/development/info', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/development/info`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/development/logger', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/development/logger`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/advanced/events', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/advanced/events`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/manage/categories', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/categories`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/manage/categories/1', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/categories/1`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/manage/catgories?cid=<cid>', async () => {
		const { cid: rootCid } = await categories.create({ name: 'parent category' });
		const { cid: childCid } = await categories.create({ name: 'child category', parentCid: rootCid });
		const { response, body } = await helpers.request('get', `/api/admin/manage/categories?cid=${rootCid}`, {
			jar,
			json: true,
		});
		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(body.categoriesTree[0].cid, rootCid);
		assert.strictEqual(body.categoriesTree[0].children[0].cid, childCid);
		assert.strictEqual(body.breadcrumbs[0].text, '[[admin/manage/categories:top-level]]');
		assert.strictEqual(body.breadcrumbs[1].text, 'parent category');
	});

	it('should load /admin/manage/categories/1/analytics', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/categories/1/analytics`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/extend/rewards', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/extend/rewards`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/extend/widgets', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/extend/widgets`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/manage/tags', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/manage/tags`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('/post-queue should 404 for regular user', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/post-queue`);
		assert.equal(response.statusCode, 404);
		assert(body);
	});

	it('should load /post-queue', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/post-queue`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('/ip-blacklist should 404 for regular user', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/ip-blacklist`);
		assert.equal(response.statusCode, 404);
		assert(body);
	});

	it('should load /ip-blacklist', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/ip-blacklist`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/appearance/themes', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/appearance/themes`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/appearance/skins', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/appearance/skins`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /admin/appearance/customise', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/api/admin/appearance/customise`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
	});

	it('should load /recent in maintenance mode', async () => {
		meta.config.maintenanceMode = 1;
		const { response, body } = await request.get(`${nconf.get('url')}/api/recent`, { jar });
		assert.equal(response.statusCode, 200);
		meta.config.maintenanceMode = 0;
		assert(body);
	});

	describe('mods page', () => {
		let moderatorJar;
		let regularJar;

		before(async () => {
			moderatorJar = (await helpers.loginUser('moderator', 'modmod')).jar;
			regularJar = (await helpers.loginUser('regular', 'regularpwd')).jar;
			await groups.join(`cid:${cid}:privileges:moderate`, moderatorUid);
		});

		it('should error with no privileges', async () => {
			const { body } = await request.get(`${nconf.get('url')}/api/flags`);
			assert.deepStrictEqual(body, {
				status: {
					code: 'not-authorised',
					message: 'A valid login session was not found. Please log in and try again.',
				},
				response: {},
			});
		});

		it('should load flags page data', async () => {
			const { body } = await request.get(`${nconf.get('url')}/api/flags`, { jar: moderatorJar });
			assert(body);
			assert(body.flags);
			assert(body.filters);
			assert.equal(body.filters.cid.indexOf(cid), -1);
		});

		it('should return a 404 if flag does not exist', async () => {
			const { response } = await request.get(`${nconf.get('url')}/api/flags/123123123`, {
				jar: moderatorJar,
				headers: {
					Accept: 'text/html, application/json',
				},
			});
			assert.strictEqual(response.statusCode, 404);
		});

		it("should error when you attempt to flag a privileged user's post", async () => {
			const { response, body } = await helpers.request('post', '/api/v3/flags', {
				jar: regularJar,
				body: {
					id: pid,
					type: 'post',
					reason: 'spam',
				},
			});
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.code, 'bad-request');
			assert.strictEqual(
				body.status.message,
				'You are not allowed to flag the profiles or content of privileged users (moderators/global moderators/admins)'
			);
		});

		it('should error with not enough reputation to flag', async () => {
			const oldValue = meta.config['min:rep:flag'];
			meta.config['min:rep:flag'] = 1000;
			const { response, body } = await helpers.request('post', '/api/v3/flags', {
				jar: regularJar,
				body: {
					id: regularPid,
					type: 'post',
					reason: 'spam',
				},
			});
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.code, 'bad-request');
			assert.strictEqual(body.status.message, 'You need 1000 reputation to flag this post');
			meta.config['min:rep:flag'] = oldValue;
		});

		it('should return flag details', async () => {
			const oldValue = meta.config['min:rep:flag'];
			meta.config['min:rep:flag'] = 0;
			await helpers.request('post', '/api/v3/flags', {
				jar: regularJar,
				body: {
					id: regularPid,
					type: 'post',
					reason: 'spam',
				},
			});
			meta.config['min:rep:flag'] = oldValue;

			const flagsResult = await helpers.request('get', `/api/flags`, {
				json: true,
				jar: moderatorJar,
			});

			assert(flagsResult.body);
			assert(Array.isArray(flagsResult.body.flags));
			const { flagId } = flagsResult.body.flags[0];

			const { body } = await helpers.request('get', `/api/flags/${flagId}`, {
				jar: moderatorJar,
			});
			assert(body.reports);
			assert(Array.isArray(body.reports));
			assert.strictEqual(body.reports[0].reporter.username, 'regular');
		});
	});

	it('should escape special characters in config', async () => {
		function onConfigGet(config, callback) {
			config.someValue = '"foo"';
			config.otherValue = "'123'";
			config.script = '</script>';
			callback(null, config);
		}
		plugins.hooks.register('somePlugin', { hook: 'filter:config.get', method: onConfigGet });
		const { response, body } = await request.get(`${nconf.get('url')}/admin`, { jar });
		assert.equal(response.statusCode, 200);
		assert(body);
		assert(body.includes('"someValue":"\\\\"foo\\\\""'));
		assert(body.includes('"otherValue":"\\\'123\\\'"'));
		assert(body.includes('"script":"<\\/script>"'));

		const { response: res2, body: body2 } = await request.get(nconf.get('url'), { jar });
		assert.equal(res2.statusCode, 200);
		assert(body2);
		assert(body2.includes('"someValue":"\\\\"foo\\\\""'));
		assert(body2.includes('"otherValue":"\\\'123\\\'"'));
		assert(body2.includes('"script":"<\\/script>"'));

		plugins.hooks.unregister('somePlugin', 'filter:config.get', onConfigGet);
	});

	describe('admin page privileges', () => {
		let uid;
		let requestOpts;

		before(async () => {
			uid = await user.create({ username: 'regularjoe', password: 'barbar' });
			requestOpts = { jar: (await helpers.loginUser('regularjoe', 'barbar')).jar };
		});

		describe('routeMap parsing', () => {
			it('should allow normal user access to admin pages', async function () {
				this.timeout(50000);

				const uploadRoutes = [
					'category/uploadpicture',
					'uploadfavicon',
					'uploadTouchIcon',
					'uploadMaskableIcon',
					'uploadlogo',
					'uploadOgImage',
					'uploadDefaultAvatar',
				];
				const adminRoutes = Object.keys(privileges.admin.routeMap).filter(route => !uploadRoutes.includes(route));

				for (const route of adminRoutes) {
					await privileges.admin.rescind([privileges.admin.routeMap[route]], uid);
					let { response } = await request.get(`${nconf.get('url')}/api/admin/${route}`, requestOpts);
					assert.strictEqual(response.statusCode, 403);

					await privileges.admin.give([privileges.admin.routeMap[route]], uid);
					({ response } = await request.get(`${nconf.get('url')}/api/admin/${route}`, requestOpts));
					assert.strictEqual(response.statusCode, 200);

					await privileges.admin.rescind([privileges.admin.routeMap[route]], uid);
				}

				for (const route of adminRoutes) {
					await privileges.admin.rescind([privileges.admin.routeMap[route]], uid);
					let { response } = await request.get(`${nconf.get('url')}/api/admin`, requestOpts);
					assert.strictEqual(response.statusCode, 403);

					await privileges.admin.give([privileges.admin.routeMap[route]], uid);
					({ response } = await request.get(`${nconf.get('url')}/api/admin`, requestOpts));
					assert.strictEqual(response.statusCode, 200);

					await privileges.admin.rescind([privileges.admin.routeMap[route]], uid);
				}
			});
		});

		describe('routePrefixMap parsing', () => {
			it('should allow normal user access to admin pages', async () => {
				for (const route of Object.keys(privileges.admin.routePrefixMap)) {
					await privileges.admin.rescind([privileges.admin.routePrefixMap[route]], uid);
					let { response } = await request.get(`${nconf.get('url')}/api/admin/${route}foobar/derp`, requestOpts);
					assert.strictEqual(response.statusCode, 403);

					await privileges.admin.give([privileges.admin.routePrefixMap[route]], uid);
					({ response } = await request.get(`${nconf.get('url')}/api/admin/${route}foobar/derp`, requestOpts));
					assert.strictEqual(response.statusCode, 404);

					await privileges.admin.rescind([privileges.admin.routePrefixMap[route]], uid);
				}
			});
		});

		it('should list all admin privileges', async () => {
			const privs = await privileges.admin.getPrivilegeList();
			assert.deepStrictEqual(privs, [
				'admin:dashboard',
				'admin:categories',
				'admin:privileges',
				'admin:admins-mods',
				'admin:users',
				'admin:groups',
				'admin:tags',
				'admin:settings',
				'groups:admin:dashboard',
				'groups:admin:categories',
				'groups:admin:privileges',
				'groups:admin:admins-mods',
				'groups:admin:users',
				'groups:admin:groups',
				'groups:admin:tags',
				'groups:admin:settings',
			]);
		});

		it('should list user admin privileges', async () => {
			const privs = await privileges.admin.userPrivileges(adminUid);
			assert.deepStrictEqual(privs, {
				'admin:dashboard': false,
				'admin:categories': false,
				'admin:privileges': false,
				'admin:admins-mods': false,
				'admin:users': false,
				'admin:groups': false,
				'admin:tags': false,
				'admin:settings': false,
			});
		});

		it('should check if group has admin group privilege', async () => {
			await groups.create({ name: 'some-special-group', private: 1, hidden: 1 });
			await privileges.admin.give(['groups:admin:users', 'groups:admin:groups'], 'some-special-group');
			const can = await privileges.admin.canGroup('admin:users', 'some-special-group');
			assert.strictEqual(can, true);
			const privs = await privileges.admin.groupPrivileges('some-special-group');
			assert.deepStrictEqual(privs, {
				'groups:admin:dashboard': false,
				'groups:admin:categories': false,
				'groups:admin:privileges': false,
				'groups:admin:admins-mods': false,
				'groups:admin:users': true,
				'groups:admin:groups': true,
				'groups:admin:tags': false,
				'groups:admin:settings': false,
			});
		});

		it('should not have admin:privileges', async () => {
			const res = await privileges.admin.list(regularUid);
			assert.strictEqual(res.keys.users.includes('admin:privileges'), false);
			assert.strictEqual(res.keys.groups.includes('admin:privileges'), false);
		});
	});
});