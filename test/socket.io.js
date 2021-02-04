'use strict';

// see https://gist.github.com/jfromaniello/4087861#gistcomment-1447029


process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const util = require('util');

const sleep = util.promisify(setTimeout);
const assert = require('assert');
const async = require('async');
const nconf = require('nconf');
const request = require('request');

const cookies = request.jar();

const db = require('./mocks/databasemock');
const user = require('../src/user');
const groups = require('../src/groups');
const categories = require('../src/categories');
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

	before((done) => {
		async.series([
			async.apply(user.create, { username: 'admin', password: 'adminpwd' }),
			async.apply(user.create, { username: 'regular', password: 'regularpwd', email: 'regular@test.com' }),
			async.apply(categories.create, {
				name: 'Test Category',
				description: 'Test category created by testing script',
			}),
		], (err, data) => {
			if (err) {
				return done(err);
			}
			adminUid = data[0];
			regularUid = data[1];
			cid = data[2].cid;

			groups.join('administrators', data[0], done);
		});
	});


	it('should connect and auth properly', (done) => {
		request.get({
			url: `${nconf.get('url')}/api/config`,
			jar: cookies,
			json: true,
		}, (err, res, body) => {
			assert.ifError(err);

			request.post(`${nconf.get('url')}/login`, {
				jar: cookies,
				form: {
					username: 'admin',
					password: 'adminpwd',
				},
				headers: {
					'x-csrf-token': body.csrf_token,
				},
				json: true,
			}, (err, res) => {
				assert.ifError(err);

				helpers.connectSocketIO(res, (err, _io) => {
					io = _io;
					assert.ifError(err);

					done();
				});
			});
		});
	});

	it('should return error for unknown event', (done) => {
		io.emit('unknown.event', (err) => {
			assert(err);
			assert.equal(err.message, '[[error:invalid-event]]');
			done();
		});
	});

	it('should get installed themes', (done) => {
		const themes = ['nodebb-theme-lavender', 'nodebb-theme-persona', 'nodebb-theme-vanilla'];
		io.emit('admin.themes.getInstalled', (err, data) => {
			assert.ifError(err);
			assert(data);
			const installed = data.map(theme => theme.id);
			themes.forEach((theme) => {
				assert.notEqual(installed.indexOf(theme), -1);
			});
			done();
		});
	});

	it('should post a topic', (done) => {
		io.emit('topics.post', { title: 'test topic title', content: 'test topic main post content', uid: adminUid, cid: cid }, (err, result) => {
			assert.ifError(err);
			assert.equal(result.user.username, 'admin');
			assert.equal(result.category.cid, cid);
			assert.equal(result.mainPost.content, 'test topic main post content');
			tid = result.tid;
			done();
		});
	});

	it('should reply to topic', (done) => {
		io.emit('posts.reply', { tid: tid, uid: adminUid, content: 'test post content' }, (err, result) => {
			assert.ifError(err);
			assert.equal(result.uid, adminUid);
			assert.equal(result.user.username, 'admin');
			assert.equal(result.topic.tid, tid);
			done();
		});
	});

	it('should get more unread topics', (done) => {
		io.emit('topics.loadMoreSortedTopics', { after: 0, count: 10, direction: 1, sort: 'unread' }, (err, result) => {
			assert.ifError(err);
			assert(Array.isArray(result.topics));
			done();
		});
	});

	it('should ban a user', (done) => {
		const socketUser = require('../src/socket.io/user');
		socketUser.banUsers({ uid: adminUid }, { uids: [regularUid], reason: 'spammer' }, (err) => {
			assert.ifError(err);
			user.getLatestBanInfo(regularUid, (err, data) => {
				assert.ifError(err);
				assert(data.uid);
				assert(data.timestamp);
				assert(data.hasOwnProperty('banned_until'));
				assert(data.hasOwnProperty('banned_until_readable'));
				assert.equal(data.reason, 'spammer');
				done();
			});
		});
	});

	it('should return ban reason', (done) => {
		user.bans.getReason(regularUid, (err, reason) => {
			assert.ifError(err);
			assert.equal(reason, 'spammer');
			done();
		});
	});

	it('should unban a user', (done) => {
		const socketUser = require('../src/socket.io/user');
		socketUser.unbanUsers({ uid: adminUid }, [regularUid], (err) => {
			assert.ifError(err);
			user.bans.isBanned(regularUid, (err, isBanned) => {
				assert.ifError(err);
				assert(!isBanned);
				done();
			});
		});
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
		it('should create a user', async () => {
			const userData = await socketAdmin.user.createUser({ uid: adminUid }, { username: 'foo1' });
			uid = userData.uid;
			const isMember = await groups.isMember(userData.uid, 'registered-users');
			assert(isMember);
		});

		it('should delete users', async () => {
			await socketAdmin.user.deleteUsers({ uid: adminUid }, [uid]);
			await sleep(500);
			const isMember = await groups.isMember(uid, 'registered-users');
			assert(!isMember);
		});

		it('should error if user does not exist', (done) => {
			socketAdmin.user.deleteUsersAndContent({ uid: adminUid }, [uid], (err) => {
				assert.strictEqual(err.message, '[[error:no-user]]');
				done();
			});
		});

		it('should delete users and their content', async () => {
			const userData = await socketAdmin.user.createUser({ uid: adminUid }, { username: 'foo2' });
			await socketAdmin.user.deleteUsersAndContent({ uid: adminUid }, [userData.uid]);
			await sleep(500);
			const isMember = await groups.isMember(userData.uid, 'registered-users');
			assert(!isMember);
		});
	});

	it('should error with invalid data', (done) => {
		socketAdmin.user.createUser({ uid: adminUid }, null, (err) => {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should reset lockouts', (done) => {
		socketAdmin.user.resetLockouts({ uid: adminUid }, [regularUid], (err) => {
			assert.ifError(err);
			done();
		});
	});

	describe('validation emails', () => {
		const meta = require('../src/meta');
		const plugins = require('../src/plugins');

		async function dummyEmailerHook(data) {
			// pretend to handle sending emails
		}
		before(() => {
			// Attach an emailer hook so related requests do not error
			plugins.hooks.register('emailer-test', {
				hook: 'filter:email.send',
				method: dummyEmailerHook,
			});
		});
		after(() => {
			plugins.hooks.unregister('emailer-test', 'filter:email.send');
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

		it('should error if email validation is not required', (done) => {
			socketAdmin.user.sendValidationEmail({ uid: adminUid }, [regularUid], (err) => {
				assert.equal(err.message, '[[error:email-confirmations-are-disabled]]');
				done();
			});
		});

		it('should send validation email', (done) => {
			meta.config.requireEmailConfirmation = 1;
			socketAdmin.user.sendValidationEmail({ uid: adminUid }, [regularUid], (err) => {
				assert.ifError(err);
				meta.config.requireEmailConfirmation = 0;
				done();
			});
		});
	});

	it('should push unread notifications on reconnect', (done) => {
		const socketMeta = require('../src/socket.io/meta');
		socketMeta.reconnected({ uid: 1 }, {}, (err) => {
			assert.ifError(err);
			done();
		});
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
						assert(data.hasOwnProperty('topics'));
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

	it('should toggle plugin install', function (done) {
		this.timeout(0);
		socketAdmin.plugins.toggleInstall({ uid: adminUid }, { id: 'nodebb-plugin-location-to-map', version: 'latest' }, (err, data) => {
			assert.ifError(err);
			assert.equal(data.name, 'nodebb-plugin-location-to-map');
			done();
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

	it('should upgrade plugin', function (done) {
		this.timeout(0);
		socketAdmin.plugins.upgrade({ uid: adminUid }, { id: 'nodebb-plugin-location-to-map', version: 'latest' }, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should error with invalid data', (done) => {
		socketAdmin.widgets.set({ uid: adminUid }, null, (err) => {
			assert.equal(err.message, '[[error:invalid-data]]');
			done();
		});
	});

	it('should error with invalid data', (done) => {
		const data = [{ template: 'global', location: 'sidebar', widgets: [{ widget: 'html', data: { html: 'test', title: 'test', container: '' } }] }];
		socketAdmin.widgets.set({ uid: adminUid }, data, (err) => {
			assert.ifError(err);
			db.getObjectField('widgets:global', 'sidebar', (err, widgetData) => {
				assert.ifError(err);

				assert.equal(JSON.parse(widgetData)[0].data.html, 'test');
				done();
			});
		});
	});

	it('should clear sitemap cache', (done) => {
		socketAdmin.settings.clearSitemapCache({ uid: adminUid }, {}, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should send test email', (done) => {
		socketAdmin.email.test({ uid: adminUid }, { template: 'digest.tpl' }, (err) => {
			assert.ifError(err);
			done();
		});
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

		it('should not error on valid email', (done) => {
			socketUser.reset.send({ uid: 0 }, 'regular@test.com', (err) => {
				assert.ifError(err);

				async.parallel({
					count: async.apply(db.sortedSetCount.bind(db), 'reset:issueDate', 0, Date.now()),
					event: async.apply(events.getEvents, '', 0, 0),
				}, (err, data) => {
					assert.ifError(err);
					assert.strictEqual(data.count, 1);

					// Event validity
					assert.strictEqual(data.event.length, 1);
					const event = data.event[0];
					assert.strictEqual(event.type, 'password-reset');
					assert.strictEqual(event.text, '[[success:success]]');

					done();
				});
			});
		});

		it('should not generate code if rate limited', (done) => {
			socketUser.reset.send({ uid: 0 }, 'regular@test.com', (err) => {
				assert.ifError(err);

				async.parallel({
					count: async.apply(db.sortedSetCount.bind(db), 'reset:issueDate', 0, Date.now()),
					event: async.apply(events.getEvents, '', 0, 0),
				}, (err, data) => {
					assert.ifError(err);
					assert.strictEqual(data.count, 1);	// should still equal 1

					// Event validity
					assert.strictEqual(data.event.length, 1);
					const event = data.event[0];
					assert.strictEqual(event.type, 'password-reset');
					assert.strictEqual(event.text, '[[error:reset-rate-limited]]');

					done();
				});
			});
		});

		it('should not error on invalid email (but not generate reset code)', (done) => {
			socketUser.reset.send({ uid: 0 }, 'irregular@test.com', (err) => {
				assert.ifError(err);

				db.sortedSetCount('reset:issueDate', 0, Date.now(), (err, count) => {
					assert.ifError(err);
					assert.strictEqual(count, 1);
					done();
				});
			});
		});

		it('should error on no email', (done) => {
			socketUser.reset.send({ uid: 0 }, '', (err) => {
				assert(err instanceof Error);
				assert.strictEqual(err.message, '[[error:invalid-data]]');
				done();
			});
		});
	});
});
