'use strict';

// see https://gist.github.com/jfromaniello/4087861#gistcomment-1447029


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const util = require('util');

const sleep = util.promisify(setTimeout);
const assert = require('assert');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const user = require('../src/user');
const groups = require('../src/groups');
const categories = require('../src/categories');
const topics = require('../src/topics');
const helpers = require('./helpers');
const meta = require('../src/meta');
const events = require('../src/events');

const socketAdmin = require('../src/socket.io/admin');

describe('socket.io', () => {
	let io;
	let cid;
	let tid;
	let adminUid;
	let regularUid;

	before(async () => {
		const data = await Promise.all([
			user.create({ username: 'admin', password: 'adminpwd' }),
			user.create({ username: 'regular', password: 'regularpwd' }),
			categories.create({
				name: 'Test Category',
				description: 'Test category created by testing script',
			}),
		]);
		adminUid = data[0];
		await groups.join('administrators', data[0]);

		regularUid = data[1];
		await user.setUserField(regularUid, 'email', 'regular@test.com');
		await user.email.confirmByUid(regularUid);

		cid = data[2].cid;
		await topics.post({
			uid: adminUid,
			cid: cid,
			title: 'Test Topic',
			content: 'Test topic content',
		});
	});


	it('should connect and auth properly', async () => {
		const { response, csrf_token } = await helpers.loginUser('admin', 'adminpwd');
		io = await helpers.connectSocketIO(response, csrf_token);
		assert(io);
		assert(io.emit);
	});

	it('should return error for unknown event', (done) => {
		io.emit('unknown.event', (err) => {
			assert(err);
			assert.equal(err.message, '[[error:invalid-event, unknown.event]]');
			done();
		});
	});

	it('should return error for unknown event', (done) => {
		io.emit('user.gdpr.__proto__.constructor.toString', (err) => {
			assert(err);
			assert.equal(err.message, '[[error:invalid-event, user.gdpr.__proto__.constructor.toString]]');
			done();
		});
	});

	it('should return error for unknown event', (done) => {
		io.emit('constructor.toString', (err) => {
			assert(err);
			assert.equal(err.message, '[[error:invalid-event, constructor.toString]]');
			done();
		});
	});

	it('should get installed themes', (done) => {
		const themes = ['nodebb-theme-persona'];
		io.emit('admin.themes.getInstalled', (err, data) => {
			assert.ifError(err);
			assert(data);
			const installed = data.map(theme => theme.id);
			themes.forEach((theme) => {
				assert(installed.includes(theme));
			});
			done();
		});
	});

	it('should ban a user', async () => {
		const apiUser = require('../src/api/users');
		await apiUser.ban({ uid: adminUid }, { uid: regularUid, reason: 'spammer' });
		const data = await user.getLatestBanInfo(regularUid);
		assert(data.uid);
		assert(data.timestamp);
		assert(data.hasOwnProperty('banned_until'));
		assert(data.hasOwnProperty('banned_until_readable'));
		assert.equal(data.reason, 'spammer');
	});

	it('should return ban reason', (done) => {
		user.bans.getReason(regularUid, (err, reason) => {
			assert.ifError(err);
			assert.equal(reason, 'spammer');
			done();
		});
	});

	it('should unban a user', async () => {
		const apiUser = require('../src/api/users');
		await apiUser.unban({ uid: adminUid }, { uid: regularUid });
		const isBanned = await user.bans.isBanned(regularUid);
		assert(!isBanned);
	});

	it('should make user admin', (done) => {
		socketAdmin.user.makeAdmins({ uid: adminUid }, [regularUid], (err) => {
			assert.ifError(err);
			groups.isMember(regularUid, 'administrators', (err, isMember) => {
				assert.ifError(err);
				assert(isMember);
				done();
			});
		});
	});

	it('should make user non-admin', (done) => {
		socketAdmin.user.removeAdmins({ uid: adminUid }, [regularUid], (err) => {
			assert.ifError(err);
			groups.isMember(regularUid, 'administrators', (err, isMember) => {
				assert.ifError(err);
				assert(!isMember);
				done();
			});
		});
	});

	describe('user create/delete', () => {
		let uid;
		const apiUsers = require('../src/api/users');
		it('should create a user', async () => {
			const userData = await apiUsers.create({ uid: adminUid }, { username: 'foo1' });
			uid = userData.uid;
			const isMember = await groups.isMember(userData.uid, 'registered-users');
			assert(isMember);
		});

		it('should delete users', async () => {
			await apiUsers.delete({ uid: adminUid }, { uid });
			await sleep(500);
			const isMember = await groups.isMember(uid, 'registered-users');
			assert(!isMember);
		});

		it('should error if user does not exist', async () => {
			let err;
			try {
				await apiUsers.deleteMany({ uid: adminUid }, { uids: [uid] });
			} catch (_err) {
				err = _err;
			}
			assert.strictEqual(err.message, '[[error:no-user]]');
		});

		it('should delete users and their content', async () => {
			const userData = await apiUsers.create({ uid: adminUid }, { username: 'foo2' });
			await apiUsers.deleteMany({ uid: adminUid }, { uids: [userData.uid] });
			await sleep(500);
			const isMember = await groups.isMember(userData.uid, 'registered-users');
			assert(!isMember);
		});

		it('should error with invalid data', async () => {
			let err;
			try {
				await apiUsers.create({ uid: adminUid }, null);
			} catch (_err) {
				err = _err;
			}
			assert.strictEqual(err.message, '[[error:invalid-data]]');
		});
	});

	it('should load user groups', async () => {
		const { users } = await socketAdmin.user.loadGroups({ uid: adminUid }, [adminUid]);
		assert.strictEqual(users[0].username, 'admin');
		assert(Array.isArray(users[0].groups));
	});

	it('should error with invalid data set user reputation', async () => {
		await assert.rejects(
			socketAdmin.user.setReputation({ uid: adminUid }, null),
			{ message: '[[error:invalid-data]]' }
		);
		await assert.rejects(
			socketAdmin.user.setReputation({ uid: adminUid }, {}),
			{ message: '[[error:invalid-data]]' }
		);
		await assert.rejects(
			socketAdmin.user.setReputation({ uid: adminUid }, { uids: [], value: null }),
			{ message: '[[error:invalid-data]]' }
		);
	});

	it('should set user reputation', async () => {
		await socketAdmin.user.setReputation({ uid: adminUid }, { uids: [adminUid], value: 10 });
		assert.strictEqual(10, await db.sortedSetScore('users:reputation', adminUid));
	});

	it('should reset lockouts', (done) => {
		socketAdmin.user.resetLockouts({ uid: adminUid }, [regularUid], (err) => {
			assert.ifError(err);
			done();
		});
	});

	describe('validation emails', () => {
		const plugins = require('../src/plugins');

		async function dummyEmailerHook(data) {
			// pretend to handle sending emails
		}
		before(() => {
			// Attach an emailer hook so related requests do not error
			plugins.hooks.register('emailer-test', {
				hook: 'static:email.send',
				method: dummyEmailerHook,
			});
		});
		after(() => {
			plugins.hooks.unregister('emailer-test', 'static:email.send');
		});

		it('should validate emails', (done) => {
			socketAdmin.user.validateEmail({ uid: adminUid }, [regularUid], (err) => {
				assert.ifError(err);
				user.getUserField(regularUid, 'email:confirmed', (err, emailConfirmed) => {
					assert.ifError(err);
					assert.equal(parseInt(emailConfirmed, 10), 1);
					done();
				});
			});
		});

		it('should error with invalid uids', (done) => {
			socketAdmin.user.sendValidationEmail({ uid: adminUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should send validation email', (done) => {
			socketAdmin.user.sendValidationEmail({ uid: adminUid }, [regularUid], (err) => {
				assert.ifError(err);
				done();
			});
		});
	});

	it('should push unread notifications/chats on reconnect', async () => {
		const socketMeta = require('../src/socket.io/meta');
		await socketMeta.reconnected({ uid: 1 }, {});
	});


	it('should error if the room is missing', (done) => {
		io.emit('meta.rooms.enter', null, (err) => {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should return if uid is 0', (done) => {
		const socketMeta = require('../src/socket.io/meta');
		socketMeta.rooms.enter({ uid: 0 }, null, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should join a room', (done) => {
		io.emit('meta.rooms.enter', { enter: 'recent_topics' }, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should leave current room', (done) => {
		io.emit('meta.rooms.leaveCurrent', {}, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should get server time', (done) => {
		io.emit('admin.getServerTime', null, (err, time) => {
			assert.ifError(err);
			assert(time);
			done();
		});
	});

	it('should error to get daily analytics with invalid data', (done) => {
		io.emit('admin.analytics.get', null, (err) => {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should get daily analytics', (done) => {
		io.emit('admin.analytics.get', { graph: 'traffic', units: 'days' }, (err, data) => {
			assert.ifError(err);
			assert(data);
			assert(data.summary);
			done();
		});
	});

	it('should get hourly analytics', (done) => {
		io.emit('admin.analytics.get', { graph: 'traffic', units: 'hours' }, (err, data) => {
			assert.ifError(err);
			assert(data);
			assert(data.summary);
			done();
		});
	});

	it('should allow a custom date range for traffic graph analytics', (done) => {
		io.emit('admin.analytics.get', { graph: 'traffic', units: 'days', amount: '7' }, (err, data) => {
			assert.ifError(err);
			assert(data);
			assert(data.pageviews);
			assert(data.uniqueVisitors);
			assert.strictEqual(7, data.pageviews.length);
			assert.strictEqual(7, data.uniqueVisitors.length);
			done();
		});
	});

	it('should return error', (done) => {
		socketAdmin.before({ uid: 10 }, 'someMethod', {}, (err) => {
			assert.equal(err.message, '[[error:no-privileges]]');
			done();
		});
	});

	it('should get room stats', (done) => {
		io.emit('meta.rooms.enter', { enter: 'topic_1' }, (err) => {
			assert.ifError(err);
			socketAdmin.rooms.getAll({ uid: 10 }, {}, (err) => {
				assert.ifError(err);
				setTimeout(() => {
					socketAdmin.rooms.getAll({ uid: 10 }, {}, (err, data) => {
						assert.ifError(err);
						assert(data.hasOwnProperty('onlineGuestCount'));
						assert(data.hasOwnProperty('onlineRegisteredCount'));
						assert(data.hasOwnProperty('socketCount'));
						assert(data.hasOwnProperty('topTenTopics'));
						assert(data.hasOwnProperty('users'));
						done();
					});
				}, 1000);
			});
		});
	});

	it('should get room stats', (done) => {
		io.emit('meta.rooms.enter', { enter: 'category_1' }, (err) => {
			assert.ifError(err);
			socketAdmin.rooms.getAll({ uid: 10 }, {}, (err) => {
				assert.ifError(err);
				setTimeout(() => {
					socketAdmin.rooms.getAll({ uid: 10 }, {}, (err, data) => {
						assert.ifError(err);
						assert.equal(data.users.category, 1, JSON.stringify(data, null, 4));
						done();
					});
				}, 1000);
			});
		});
	});

	it('should get admin search dictionary', (done) => {
		socketAdmin.getSearchDict({ uid: adminUid }, {}, (err, data) => {
			assert.ifError(err);
			assert(Array.isArray(data));
			assert(data[0].namespace);
			assert(data[0].translations);
			assert(data[0].title);
			done();
		});
	});

	it('should fire event', (done) => {
		io.on('testEvent', (data) => {
			assert.equal(data.foo, 1);
			done();
		});
		socketAdmin.fireEvent({ uid: adminUid }, { name: 'testEvent', payload: { foo: 1 } }, (err) => {
			assert.ifError(err);
		});
	});

	it('should error with invalid data', (done) => {
		socketAdmin.themes.set({ uid: adminUid }, null, (err) => {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should set theme to bootswatch', (done) => {
		socketAdmin.themes.set({ uid: adminUid }, {
			type: 'bootswatch',
			src: '//maxcdn.bootstrapcdn.com/bootswatch/latest/darkly/bootstrap.min.css',
			id: 'darkly',
		}, (err) => {
			assert.ifError(err);
			meta.configs.getFields(['theme:src', 'bootswatchSkin'], (err, fields) => {
				assert.ifError(err);
				assert.equal(fields['theme:src'], '//maxcdn.bootstrapcdn.com/bootswatch/latest/darkly/bootstrap.min.css');
				assert.equal(fields.bootswatchSkin, 'darkly');
				done();
			});
		});
	});

	it('should set theme to local persona', (done) => {
		socketAdmin.themes.set({ uid: adminUid }, { type: 'local', id: 'nodebb-theme-persona' }, (err) => {
			assert.ifError(err);
			meta.configs.get('theme:id', (err, id) => {
				assert.ifError(err);
				assert.equal(id, 'nodebb-theme-persona');
				done();
			});
		});
	});

	it('should toggle plugin active', (done) => {
		socketAdmin.plugins.toggleActive({ uid: adminUid }, 'nodebb-plugin-location-to-map', (err, data) => {
			assert.ifError(err);
			assert.deepEqual(data, { id: 'nodebb-plugin-location-to-map', active: true });
			done();
		});
	});

	describe('install/upgrade plugin', () => {
		it('should toggle plugin install', function (done) {
			this.timeout(0);
			const oldValue = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';
			socketAdmin.plugins.toggleInstall({
				uid: adminUid,
			}, {
				id: 'nodebb-plugin-location-to-map',
				version: 'latest',
			}, (err, data) => {
				assert.ifError(err);
				assert.equal(data.name, 'nodebb-plugin-location-to-map');
				process.env.NODE_ENV = oldValue;
				done();
			});
		});

		it('should upgrade plugin', function (done) {
			this.timeout(0);
			const oldValue = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';
			socketAdmin.plugins.upgrade({
				uid: adminUid,
			}, {
				id: 'nodebb-plugin-location-to-map',
				version: 'latest',
			}, (err) => {
				assert.ifError(err);
				process.env.NODE_ENV = oldValue;
				done();
			});
		});
	});

	it('should get list of active plugins', (done) => {
		socketAdmin.plugins.getActive({ uid: adminUid }, {}, (err, data) => {
			assert.ifError(err);
			assert(Array.isArray(data));
			done();
		});
	});

	it('should order active plugins', (done) => {
		const data = [
			{ name: 'nodebb-theme-persona', order: 0 },
			{ name: 'nodebb-plugin-dbsearch', order: 1 },
			{ name: 'nodebb-plugin-markdown', order: 2 },
			{ ignoreme: 'wrong data' },
		];
		socketAdmin.plugins.orderActivePlugins({ uid: adminUid }, data, (err) => {
			assert.ifError(err);
			db.sortedSetRank('plugins:active', 'nodebb-plugin-dbsearch', (err, rank) => {
				assert.ifError(err);
				assert.equal(rank, 1);
				done();
			});
		});
	});

	it('should error with invalid data', (done) => {
		socketAdmin.widgets.set({ uid: adminUid }, null, (err) => {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should error with invalid data', (done) => {
		const data = [
			{
				template: 'global',
				location: 'sidebar',
				widgets: [{ widget: 'html', data: { html: 'test', title: 'test', container: '' } }],
			},
		];
		socketAdmin.widgets.set({ uid: adminUid }, data, (err) => {
			assert.ifError(err);
			db.getObjectField('widgets:global', 'sidebar', (err, widgetData) => {
				assert.ifError(err);

				assert.equal(JSON.parse(widgetData)[0].data.html, 'test');
				done();
			});
		});
	});

	it('should clear sitemap cache', async () => {
		await socketAdmin.settings.clearSitemapCache({ uid: adminUid }, {});
	});

	it('should send test email', async () => {
		const tpls = ['digest', 'banned', 'verify', 'welcome', 'notification', 'invitation'];
		try {
			for (const tpl of tpls) {
				// eslint-disable-next-line no-await-in-loop
				await socketAdmin.email.test({ uid: adminUid }, { template: tpl });
			}
		} catch (err) {
			if (err.message !== '[[error:sendmail-not-found]]') {
				assert.ifError(err);
			}
		}
	});

	it('should not error when resending digests', async () => {
		await socketAdmin.digest.resend({ uid: adminUid }, { action: 'resend-day', uid: adminUid });
		await socketAdmin.digest.resend({ uid: adminUid }, { action: 'resend-day' });
	});

	it('should error with invalid interval', async () => {
		const oldValue = meta.config.dailyDigestFreq;
		meta.config.dailyDigestFreq = 'off';
		try {
			await socketAdmin.digest.resend({ uid: adminUid }, { action: 'resend-' });
		} catch (err) {
			assert.strictEqual(err.message, '[[error:digest-not-enabled]]');
		}
		meta.config.dailyDigestFreq = oldValue;
	});

	it('should get logs', (done) => {
		const fs = require('fs');
		const path = require('path');
		meta.logs.path = path.join(nconf.get('base_dir'), 'test/files', 'output.log');
		fs.appendFile(meta.logs.path, 'some logs', (err) => {
			assert.ifError(err);

			socketAdmin.logs.get({ uid: adminUid }, {}, (err, data) => {
				assert.ifError(err);
				assert(data);
				done();
			});
		});
	});

	it('should clear logs', (done) => {
		socketAdmin.logs.clear({ uid: adminUid }, {}, (err) => {
			assert.ifError(err);
			socketAdmin.logs.get({ uid: adminUid }, {}, (err, data) => {
				assert.ifError(err);
				assert.equal(data.length, 0);
				done();
			});
		});
	});

	it('should clear errors', (done) => {
		socketAdmin.errors.clear({ uid: adminUid }, {}, (err) => {
			assert.ifError(err);
			db.exists('error:404', (err, exists) => {
				assert.ifError(err);
				assert(!exists);
				done();
			});
		});
	});

	it('should delete a single event', (done) => {
		db.getSortedSetRevRange('events:time', 0, 0, (err, eids) => {
			assert.ifError(err);
			events.deleteEvents(eids, (err) => {
				assert.ifError(err);
				db.isSortedSetMembers('events:time', eids, (err, isMembers) => {
					assert.ifError(err);
					assert(!isMembers.includes(true));
					done();
				});
			});
		});
	});

	it('should delete all events', (done) => {
		events.deleteAll((err) => {
			assert.ifError(err);
			db.sortedSetCard('events:time', (err, count) => {
				assert.ifError(err);
				assert.equal(count, 0);
				done();
			});
		});
	});

	describe('logger', () => {
		const logger = require('../src/logger');
		const index = require('../src/socket.io');
		const fs = require('fs');
		const path = require('path');

		it('should enable logging', (done) => {
			meta.config.loggerStatus = 1;
			meta.config.loggerIOStatus = 1;
			const loggerPath = path.join(__dirname, '..', 'logs', 'logger.log');
			logger.monitorConfig({ io: index.server }, { key: 'loggerPath', value: loggerPath });
			setTimeout(() => {
				io.emit('meta.rooms.enter', { enter: 'recent_topics' }, (err) => {
					assert.ifError(err);
					fs.readFile(loggerPath, 'utf-8', (err, content) => {
						assert.ifError(err);
						assert(content);
						done();
					});
				});
			}, 500);
		});

		after((done) => {
			meta.config.loggerStatus = 0;
			meta.config.loggerIOStatus = 0;
			done();
		});
	});

	describe('password reset', () => {
		const socketUser = require('../src/socket.io/user');

		it('should error if uids is not array', (done) => {
			socketAdmin.user.sendPasswordResetEmail({ uid: adminUid }, null, (err) => {
				assert.strictEqual(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if uid doesnt have email', (done) => {
			socketAdmin.user.sendPasswordResetEmail({ uid: adminUid }, [adminUid], (err) => {
				assert.strictEqual(err.message, '[[error:user-doesnt-have-email, admin]]');
				done();
			});
		});

		it('should send password reset email', async () => {
			await user.setUserField(adminUid, 'email', 'admin_test@nodebb.org');
			await user.email.confirmByUid(adminUid);
			await socketAdmin.user.sendPasswordResetEmail({ uid: adminUid }, [adminUid]);
		});

		it('should error if uids is not array', (done) => {
			socketAdmin.user.forcePasswordReset({ uid: adminUid }, null, (err) => {
				assert.strictEqual(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should for password reset', async () => {
			const then = Date.now();
			const uid = await user.create({ username: 'forceme', password: '123345' });
			await socketAdmin.user.forcePasswordReset({ uid: adminUid }, [uid]);
			const pwExpiry = await user.getUserField(uid, 'passwordExpiry');
			const sleep = util.promisify(setTimeout);
			await sleep(500);
			assert(pwExpiry > then && pwExpiry < Date.now());
		});

		it('should not error on valid email', async () => {
			await socketUser.reset.send({ uid: 0 }, 'regular@test.com');
			const [count, eventsData] = await Promise.all([
				db.sortedSetCount('reset:issueDate', 0, Date.now()),
				events.getEvents({ filter: '', start: 0, stop: 0 }),
			]);
			assert.strictEqual(count, 2);

			// Event validity
			assert.strictEqual(eventsData.length, 1);
			const event = eventsData[0];
			assert.strictEqual(event.type, 'password-reset');
			assert.strictEqual(event.text, '[[success:success]]');
		});

		it('should not generate code if rate limited', async () => {
			await assert.rejects(
				socketUser.reset.send({ uid: 0 }, 'regular@test.com'),
				{ message: '[[error:reset-rate-limited]]' },
			);
			const [count, eventsData] = await Promise.all([
				db.sortedSetCount('reset:issueDate', 0, Date.now()),
				events.getEvents({ filter: '', start: 0, stop: 0 }),
			]);
			assert.strictEqual(count, 2);

			// Event validity
			assert.strictEqual(eventsData.length, 1);
			const event = eventsData[0];
			assert.strictEqual(event.type, 'password-reset');
			assert.strictEqual(event.text, '[[error:reset-rate-limited]]');
		});

		it('should not error on invalid email (but not generate reset code)', async () => {
			await socketUser.reset.send({ uid: 0 }, 'irregular@test.com');
			const count = await db.sortedSetCount('reset:issueDate', 0, Date.now());
			assert.strictEqual(count, 2);
		});

		it('should error on no email', (done) => {
			socketUser.reset.send({ uid: 0 }, '', (err) => {
				assert(err instanceof Error);
				assert.strictEqual(err.message, '[[error:invalid-data]]');
				done();
			});
		});
	});

	it('should clear caches', async () => {
		await socketAdmin.cache.clear({ uid: adminUid }, { name: 'post' });
		await socketAdmin.cache.clear({ uid: adminUid }, { name: 'object' });
		await socketAdmin.cache.clear({ uid: adminUid }, { name: 'group' });
		await socketAdmin.cache.clear({ uid: adminUid }, { name: 'local' });
	});

	it('should toggle caches', async () => {
		const caches = {
			post: require('../src/posts/cache').getOrCreate(),
			object: require('../src/database').objectCache,
			group: require('../src/groups').cache,
			local: require('../src/cache'),
		};

		await socketAdmin.cache.toggle({ uid: adminUid }, { name: 'post', enabled: !caches.post.enabled });
		if (caches.object) {
			await socketAdmin.cache.toggle({ uid: adminUid }, { name: 'object', enabled: !caches.object.enabled });
		}
		await socketAdmin.cache.toggle({ uid: adminUid }, { name: 'group', enabled: !caches.group.enabled });
		await socketAdmin.cache.toggle({ uid: adminUid }, { name: 'local', enabled: !caches.local.enabled });

		// call again to return back to original state
		await socketAdmin.cache.toggle({ uid: adminUid }, { name: 'post', enabled: !caches.post.enabled });
		if (caches.object) {
			await socketAdmin.cache.toggle({ uid: adminUid }, { name: 'object', enabled: !caches.object.enabled });
		}
		await socketAdmin.cache.toggle({ uid: adminUid }, { name: 'group', enabled: !caches.group.enabled });
		await socketAdmin.cache.toggle({ uid: adminUid }, { name: 'local', enabled: !caches.local.enabled });
	});
});
