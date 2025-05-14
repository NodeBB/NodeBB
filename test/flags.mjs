import assert from 'assert';
import nconf from 'nconf';

import db from './mocks/databasemock.mjs';
import helpers from './helpers/index.js';
import request from '../src/request.js';
import Flags from '../src/flags.js';
import Categories from '../src/categories/index.js';
import Topics from '../src/topics/index.js';
import Posts from '../src/posts/index.js';
import User from '../src/user/index.js';
import Groups from '../src/groups/index.js';
import Meta from '../src/meta/index.js';
import Privileges from '../src/privileges/index.js';
import plugins from '../src/plugins/index.js';
import utils from '../src/utils.js';
import api from '../src/api/index.js';

// Promise-based sleep function
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Flags', () => {
	let uid1;
	let adminUid;
	let uid3;
	let moderatorUid;
	let jar;
	let csrfToken;
	let category;

	before(async () => {
		const dummyEmailerHook = async (data) => { };
		// Attach an emailer hook so related requests do not error
		plugins.hooks.register('flags-test', {
			hook: 'static:email.send',
			method: dummyEmailerHook,
		});

		// Create some stuff to flag
		uid1 = await User.create({ username: 'testUser', password: 'abcdef', email: 'b@c.com' });

		adminUid = await User.create({ username: 'testUser2', password: 'abcdef', email: 'c@d.com' });
		await Groups.join('administrators', adminUid);

		category = await Categories.create({
			name: 'test category',
		});
		await Topics.post({
			cid: category.cid,
			uid: uid1,
			title: 'Topic to flag',
			content: 'This is flaggable content',
		});

		uid3 = await User.create({
			username: 'unprivileged',
			password: 'abcdef',
			email: 'd@e.com',
		});

		moderatorUid = await User.create({
			username: 'moderator',
			password: 'abcdef',
		});
		await Privileges.categories.give(['moderate'], category.cid, [moderatorUid]);

		const login = await helpers.loginUser('moderator', 'abcdef');
		jar = login.jar;
		csrfToken = login.csrf_token;
	});

	after(() => {
		plugins.hooks.unregister('flags-test', 'static:email.send');
	});

	describe('.create()', () => {
		it('should create a flag and return its data', async () => {
			const flagData = await Flags.create('post', 1, 1, 'Test flag');
			const compare = {
				flagId: 1,
				targetId: 1,
				type: 'post',
				state: 'open',
				target_readable: 'Post 1',
			};
			assert(flagData);
			for (const key of Object.keys(compare)) {
				assert.ok(flagData[key], `undefined key ${key}`);
				assert.equal(flagData[key], compare[key]);
			}
		});

		it('should add the flag to the byCid zset for category 1 if it is of type post', async () => {
			const isMember = await db.isSortedSetMember(`flags:byCid:${1}`, 1);
			assert.ok(isMember);
		});

		it('should add the flag to the byPid zset for pid 1 if it is of type post', async () => {
			const isMember = await db.isSortedSetMember(`flags:byPid:${1}`, 1);
			assert.ok(isMember);
		});
	});

	describe('.addReport()', () => {
		let flagId;
		let postData;

		before(async () => {
			// Create a topic and flag it
			({ postData } = await Topics.post({
				cid: category.cid,
				uid: uid1,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			}));
			({ flagId } = await Flags.create('post', postData.pid, adminUid, utils.generateUUID()));
		});

		after(async () => {
			await Flags.purge([flagId]);
		});

		it('should add a report to an existing flag', async () => {
			await Flags.addReport(flagId, 'post', postData.pid, uid3, utils.generateUUID(), Date.now());
			const reports = await db.getSortedSetMembers(`flag:${flagId}:reports`);
			assert.strictEqual(reports.length, 2);
		});

		it('should add an additional report even if same user calls it again', async () => {
			await Flags.addReport(flagId, 'post', postData.pid, uid3, utils.generateUUID(), Date.now());
			const reports = await db.getSortedSetMembers(`flag:${flagId}:reports`);
			assert.strictEqual(reports.length, 3);
		});
	});

	describe('.rescindReport()', () => {
		let flagId;
		let postData;

		before(async () => {
			// Create a topic and flag it
			({ postData } = await Topics.post({
				cid: category.cid,
				uid: uid1,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			}));
			({ flagId } = await Flags.create('post', postData.pid, adminUid, utils.generateUUID()));
		});

		after(async () => {
			await Flags.purge([flagId]);
		});

		it('should remove a report from an existing flag', async () => {
			await Flags.create('post', postData.pid, uid3, utils.generateUUID());
			await Flags.rescindReport('post', postData.pid, uid3);
			const reports = await Flags.getReports(flagId);
			assert.strictEqual(reports.length, 1);
			assert(reports.every(({ reporter }) => reporter.uid !== uid3));
		});

		it('should automatically mark the flag resolved if there are no reports remaining after removal', async () => {
			await Flags.rescindReport('post', postData.pid, adminUid);
			const reports = await Flags.getReports(flagId);
			const { state } = await Flags.get(flagId);
			assert.strictEqual(reports.length, 0);
			assert.strictEqual(state, 'resolved');
		});
	});

	describe('.exists()', () => {
		it('should return Boolean True if a flag matching the flag hash already exists', async () => {
			const exists = await Flags.exists('post', 1, 1);
			assert.strictEqual(true, exists);
		});

		it('should return Boolean False if a flag matching the flag hash does not already exists', async () => {
			const exists = await Flags.exists('post', 1, 2);
			assert.strictEqual(false, exists);
		});
	});

	describe('.targetExists()', () => {
		it('should return Boolean True if the targeted element exists', async () => {
			const exists = await Flags.targetExists('post', 1);
			assert.strictEqual(true, exists);
		});

		it('should return Boolean False if the targeted element does not exist', async () => {
			const exists = await Flags.targetExists('post', 15);
			assert.strictEqual(false, exists);
		});
	});

	describe('.get()', () => {
		it('should retrieve and display a flag\'s data', async () => {
			const flagData = await Flags.get(1);
			const compare = {
				flagId: 1,
				targetId: 1,
				type: 'post',
				state: 'open',
				target_readable: 'Post 1',
			};
			assert(flagData);
			for (const key of Object.keys(compare)) {
				assert.ok(flagData[key], `undefined key ${key}`);
				assert.equal(flagData[key], compare[key]);
			}
		});

		it('should show user history for admins', async () => {
			await Groups.join('administrators', moderatorUid);
			const { body: flagData } = await request.get(`${nconf.get('url')}/api/flags/1`, {
				jar,
				headers: {
					'x-csrf-token': csrfToken,
				},
			});
			assert(flagData.history);
			assert(Array.isArray(flagData.history));
			await Groups.leave('administrators', moderatorUid);
		});

		it('should show user history for global moderators', async () => {
			await Groups.join('Global Moderators', moderatorUid);
			const { body: flagData } = await request.get(`${nconf.get('url')}/api/flags/1`, {
				jar,
				headers: {
					'x-csrf-token': csrfToken,
				},
			});
			assert(flagData.history);
			assert(Array.isArray(flagData.history));
			await Groups.leave('Global Moderators', moderatorUid);
		});
	});

	describe('.list()', () => {
		it('should show a list of flags (with one item)', async () => {
			const payload = await Flags.list({
				filters: {},
				uid: 1,
			});
			assert.ok(payload.hasOwnProperty('flags'));
			assert.ok(payload.hasOwnProperty('page'));
			assert.ok(payload.hasOwnProperty('pageCount'));
			assert.ok(Array.isArray(payload.flags));
			assert.equal(payload.flags.length, 1);

			const flagData = await Flags.get(payload.flags[0].flagId);
			assert.equal(payload.flags[0].flagId, flagData.flagId);
			assert.equal(payload.flags[0].description, flagData.description);
		});

		describe('(with filters)', () => {
			it('should return a filtered list of flags if said filters are passed in', async () => {
				const payload = await Flags.list({
					filters: {
						state: 'open',
					},
					uid: 1,
				});
				assert.ok(payload.hasOwnProperty('flags'));
				assert.ok(payload.hasOwnProperty('page'));
				assert.ok(payload.hasOwnProperty('pageCount'));
				assert.ok(Array.isArray(payload.flags));
				assert.strictEqual(1, parseInt(payload.flags[0].flagId, 10));
			});

			it('should return no flags if a filter with no matching flags is used', async () => {
				const payload = await Flags.list({
					filters: {
						state: 'rejected',
					},
					uid: 1,
				});
				assert.ok(payload.hasOwnProperty('flags'));
				assert.ok(payload.hasOwnProperty('page'));
				assert.ok(payload.hasOwnProperty('pageCount'));
				assert.ok(Array.isArray(payload.flags));
				assert.strictEqual(0, payload.flags.length);
			});

			it('should return a flag when filtered by cid 1', async () => {
				const payload = await Flags.list({
					filters: {
						cid: 1,
					},
					uid: 1,
				});
				assert.ok(payload.hasOwnProperty('flags'));
				assert.ok(payload.hasOwnProperty('page'));
				assert.ok(payload.hasOwnProperty('pageCount'));
				assert.ok(Array.isArray(payload.flags));
				assert.strictEqual(1, payload.flags.length);
			});

			it('shouldn\'t return a flag when filtered by cid 2', async () => {
				const payload = await Flags.list({
					filters: {
						cid: 2,
					},
					uid: 1,
				});
				assert.ok(payload.hasOwnProperty('flags'));
				assert.ok(payload.hasOwnProperty('page'));
				assert.ok(payload.hasOwnProperty('pageCount'));
				assert.ok(Array.isArray(payload.flags));
				assert.strictEqual(0, payload.flags.length);
			});

			it('should return a flag when filtered by both cid 1 and 2', async () => {
				const payload = await Flags.list({
					filters: {
						cid: [1, 2],
					},
					uid: 1,
				});
				assert.ok(payload.hasOwnProperty('flags'));
				assert.ok(payload.hasOwnProperty('page'));
				assert.ok(payload.hasOwnProperty('pageCount'));
				assert.ok(Array.isArray(payload.flags));
				assert.strictEqual(1, payload.flags.length);
			});

			it('should return one flag if filtered by both cid 1 and 2 and open state', async () => {
				const payload = await Flags.list({
					filters: {
						cid: [1, 2],
						state: 'open',
					},
					uid: 1,
				});
				assert.ok(payload.hasOwnProperty('flags'));
				assert.ok(payload.hasOwnProperty('page'));
				assert.ok(payload.hasOwnProperty('pageCount'));
				assert.ok(Array.isArray(payload.flags));
				assert.strictEqual(1, payload.flags.length);
			});

			it('should return no flag if filtered by both cid 1 and 2 and non-open state', async () => {
				const payload = await Flags.list({
					filters: {
						cid: [1, 2],
						state: 'resolved',
					},
					uid: 1,
				});
				assert.ok(payload.hasOwnProperty('flags'));
				assert.ok(payload.hasOwnProperty('page'));
				assert.ok(payload.hasOwnProperty('pageCount'));
				assert.ok(Array.isArray(payload.flags));
				assert.strictEqual(0, payload.flags.length);
			});
		});

		describe('(with sort)', () => {
			before(async () => {
				// Create a second flag to test sorting
				const post = await Topics.reply({
					tid: 1,
					uid: uid1,
					content: 'this is a reply -- flag me',
				});
				await Flags.create('post', post.pid, adminUid, 'another flag');
				await Flags.create('post', 1, uid3, 'additional flag report');
			});

			it('should return sorted flags latest first if no sort is passed in', async () => {
				const payload = await Flags.list({
					uid: adminUid,
				});
				assert(payload.flags.every((cur, idx) => {
					if (idx === payload.flags.length - 1) {
						return true;
					}
					const next = payload.flags[idx + 1];
					return parseInt(cur.datetime, 10) > parseInt(next.datetime, 10);
				}));
			});

			it('should return sorted flags oldest first if "oldest" sort is passed in', async () => {
				const payload = await Flags.list({
					uid: adminUid,
					sort: 'oldest',
				});
				assert(payload.flags.every((cur, idx) => {
					if (idx === payload.flags.length - 1) {
						return true;
					}
					const next = payload.flags[idx + 1];
					return parseInt(cur.datetime, 10) < parseInt(next.datetime, 10);
				}));
			});

			it('should return flags with more reports first if "reports" sort is passed in', async () => {
				const payload = await Flags.list({
					uid: adminUid,
					sort: 'reports',
				});
				assert(payload.flags.every((cur, idx) => {
					if (idx === payload.flags.length - 1) {
						return true;
					}
					const next = payload.flags[idx + 1];
					return parseInt(cur.heat, 10) >= parseInt(next.heat, 10);
				}));
			});
		});
	});

	describe('.update()', () => {
		it('should alter a flag\'s various attributes and persist them to the database', async () => {
			await Flags.update(1, adminUid, {
				state: 'wip',
				assignee: adminUid,
			});
			const data = await db.getObjectFields('flag:1', ['state', 'assignee']);
			assert.strictEqual('wip', data.state);
			assert.ok(!isNaN(parseInt(data.assignee, 10)));
			assert.strictEqual(adminUid, parseInt(data.assignee, 10));
		});

		it('should persist to the flag\'s history', async () => {
			const history = await Flags.getHistory(1);
			history.forEach((change) => {
				switch (change.attribute) {
					case 'state':
						assert.strictEqual('[[flags:state-wip]]', change.value);
						break;
					case 'assignee':
						assert.strictEqual(1, change.value);
						break;
				}
			});
		});

		it('should allow assignment if user is an admin and do nothing otherwise', async () => {
			await Flags.update(1, adminUid, {
				assignee: adminUid,
			});
			let assignee = await db.getObjectField('flag:1', 'assignee');
			assert.strictEqual(adminUid, parseInt(assignee, 10));

			await Flags.update(1, adminUid, {
				assignee: uid3,
			});
			assignee = await db.getObjectField('flag:1', 'assignee');
			assert.strictEqual(adminUid, parseInt(assignee, 10));
		});

		it('should allow assignment if user is a global mod and do nothing otherwise', async () => {
			await Groups.join('Global Moderators', uid3);
			await Flags.update(1, uid3, {
				assignee: uid3,
			});
			let assignee = await db.getObjectField('flag:1', 'assignee');
			assert.strictEqual(uid3, parseInt(assignee, 10));

			await Flags.update(1, uid3, {
				assignee: uid1,
			});
			assignee = await db.getObjectField('flag:1', 'assignee');
			assert.strictEqual(uid3, parseInt(assignee, 10));
			await Groups.leave('Global Moderators', uid3);
		});

		it('should allow assignment if user is a mod of the category, do nothing otherwise', async () => {
			await Groups.join(`cid:${category.cid}:privileges:moderate`, uid3);
			await Flags.update(1, uid3, {
				assignee: uid3,
			});
			let assignee = await db.getObjectField('flag:1', 'assignee');
			assert.strictEqual(uid3, parseInt(assignee, 10));

			await Flags.update(1, uid3, {
				assignee: uid1,
			});
			assignee = await db.getObjectField('flag:1', 'assignee');
			assert.strictEqual(uid3, parseInt(assignee, 10));
			await Groups.leave(`cid:${category.cid}:privileges:moderate`, uid3);
		});

		it('should do nothing when you attempt to set a bogus state', async () => {
			await Flags.update(1, adminUid, {
				state: 'hocus pocus',
			});
			const state = await db.getObjectField('flag:1', 'state');
			assert.strictEqual('wip', state);
		});

		describe('resolve/reject', () => {
			let result;
			let flagObj;

			beforeEach(async () => {
				result = await Topics.post({
					cid: category.cid,
					uid: uid3,
					title: 'Topic to flag',
					content: 'This is flaggable content',
				});
				flagObj = await api.flags.create({ uid: uid1 }, { type: 'post', id: result.postData.pid, reason: 'spam' });
				await sleep(2000);
			});

			it('should rescind notification if flag is resolved', async () => {
				let userNotifs = await User.notifications.getAll(adminUid);
				assert(userNotifs.includes(`flag:post:${result.postData.pid}:${uid1}`));
				await Flags.update(flagObj.flagId, adminUid, {
					state: 'resolved',
				});
				userNotifs = await User.notifications.getAll(adminUid);
				assert(!userNotifs.includes(`flag:post:${result.postData.pid}:${uid1}`));
			});

			it('should rescind notification if flag is rejected', async () => {
				let userNotifs = await User.notifications.getAll(adminUid);
				assert(userNotifs.includes(`flag:post:${result.postData.pid}:${uid1}`));
				await Flags.update(flagObj.flagId, adminUid, {
					state: 'rejected',
				});
				userNotifs = await User.notifications.getAll(adminUid);
				assert(!userNotifs.includes(`flag:post:${result.postData.pid}:${uid1}`));
			});

			it('should do nothing if flag is resolved but ACP action is not "rescind"', async () => {
				Meta.config['flags:actionOnResolve'] = '';
				let userNotifs = await User.notifications.getAll(adminUid);
				assert(userNotifs.includes(`flag:post:${result.postData.pid}:${uid1}`));
				await Flags.update(flagObj.flagId, adminUid, {
					state: 'resolved',
				});
				userNotifs = await User.notifications.getAll(adminUid);
				assert(userNotifs.includes(`flag:post:${result.postData.pid}:${uid1}`));
				delete Meta.config['flags:actionOnResolve'];
			});

			it('should do nothing if flag is rejected but ACP action is not "rescind"', async () => {
				Meta.config['flags:actionOnReject'] = '';
				let userNotifs = await User.notifications.getAll(adminUid);
				assert(userNotifs.includes(`flag:post:${result.postData.pid}:${uid1}`));
				await Flags.update(flagObj.flagId, adminUid, {
					state: 'rejected',
				});
				userNotifs = await User.notifications.getAll(adminUid);
				assert(userNotifs.includes(`flag:post:${result.postData.pid}:${uid1}`));
				delete Meta.config['flags:actionOnReject'];
			});
		});
	});

	describe('.getTarget()', () => {
		it('should return a post\'s data if queried with type "post"', async () => {
			const data = await Flags.getTarget('post', 1, 1);
			const compare = {
				uid: 1,
				pid: 1,
				content: 'This is flaggable content',
			};
			for (const key of Object.keys(compare)) {
				assert.ok(data[key]);
				assert.equal(data[key], compare[key]);
			}
		});

		it('should return a user\'s data if queried with type "user"', async () => {
			const data = await Flags.getTarget('user', 1, 1);
			const compare = {
				uid: 1,
				username: 'testUser',
				email: 'b@c.com',
			};
			for (const key of Object.keys(compare)) {
				assert.ok(data[key]);
				assert.equal(data[key], compare[key]);
			}
		});

		it('should return a plain object with no properties if the target no longer exists', async () => {
			const data = await Flags.getTarget('user', 15, 1);
			assert.strictEqual(0, Object.keys(data).length);
		});
	});

	describe('.validate()', () => {
		it('should error out if type is post and post is deleted', async () => {
			await Posts.delete(1, 1);
			try {
				await Flags.validate({
					type: 'post',
					id: 1,
					uid: 1,
				});
				assert.fail('Expected an error');
			} catch (err) {
				assert.strictEqual('[[error:post-deleted]]', err.message);
			}
			await Posts.restore(1, 1);
		});

		it('should not pass validation if flag threshold is set and user rep does not meet it', async () => {
			await Meta.configs.set('min:rep:flag', '50');
			try {
				await Flags.validate({
					type: 'post',
					id: 1,
					uid: 3,
				});
				assert.fail('Expected an error');
			} catch (err) {
				assert.strictEqual('[[error:not-enough-reputation-to-flag, 50]]', err.message);
			}
			await Meta.configs.set('min:rep:flag', 0);
		});

		it('should not error if user blocked target', async () => {
			const apiFlags = await import('../src/api/flags.js');
			const reporterUid = await User.create({ username: 'reporter' });
			const reporteeUid = await User.create({ username: 'reportee' });
			await User.blocks.add(reporteeUid, reporterUid);
			const data = await Topics.post({
				cid: 1,
				uid: reporteeUid,
				title: 'Another topic',
				content: 'This is flaggable content',
			});
			await apiFlags.default.create({ uid: reporterUid }, {
				type: 'post',
				id: data.postData.pid,
				reason: 'spam',
			});
		});

		it('should send back error if reporter does not exist', async () => {
			try {
				await Flags.validate({ uid: 123123123, id: 1, type: 'post' });
				assert.fail('Expected an error');
			} catch (err) {
				assert.equal(err.message, '[[error:no-user]]');
			}
		});
	});

	describe('.appendNote()', () => {
		it('should add a note to a flag', async () => {
			await Flags.appendNote(1, 1, 'this is my note');
			const notes = await db.getSortedSetRange('flag:1:notes', 0, -1);
			assert.strictEqual('[1,"this is my note"]', notes[0]);
			await sleep(10); // Ensure any async operations complete
		});

		it('should be a JSON string', async () => {
			const notes = await db.getSortedSetRange('flag:1:notes', 0, -1);
			try {
				JSON.parse(notes[0]);
			} catch (e) {
				assert.ifError(e);
			}
		});

		it('should insert a note in the past if a datetime is passed in', async () => {
			await Flags.appendNote(1, 1, 'this is the first note', 1626446956652);
			const note = (await db.getSortedSetRange('flag:1:notes', 0, 0)).pop();
			assert.strictEqual('[1,"this is the first note"]', note);
		});
	});

	describe('.getNotes()', () => {
		before(async () => {
			await Flags.appendNote(1, 1, 'this is the second note');
		});

		it('return should match a predefined spec', async () => {
			const notes = await Flags.getNotes(1);
			const compare = {
				uid: 1,
				content: 'this is my note',
			};
			const data = notes[1];
			for (const key of Object.keys(compare)) {
				assert.ok(data[key]);
				assert.strictEqual(data[key], compare[key]);
			}
		});

		it('should retrieve a list of notes, from newest to oldest', async () => {
			const notes = await Flags.getNotes(1);
			assert(notes[0].datetime > notes[1].datetime, `${notes[0].datetime}-${notes[1].datetime}`);
			assert.strictEqual('this is the second note', notes[0].content);
		});
	});

	describe('.appendHistory()', () => {
		let entries;

		before(async () => {
			entries = await db.sortedSetCard('flag:1:history');
		});

		it('should add a new entry into a flag\'s history', async () => {
			await Flags.appendHistory(1, 1, {
				state: 'rejected',
			});
			const history = await Flags.getHistory(1);
			assert.strictEqual(entries + 3, history.length);
		});
	});

	describe('.getHistory()', () => {
		it('should retrieve a flag\'s history', async () => {
			const history = await Flags.getHistory(1);
			assert.strictEqual(history[0].fields.state, '[[flags:state-rejected]]');
		});
	});

	describe('(v3 API)', () => {
		let pid;
		let tid;
		let jar;
		let csrfToken;

		before(async () => {
			const login = await helpers.loginUser('testUser2', 'abcdef');
			jar = login.jar;
			csrfToken = login.csrf_token;
			const result = await Topics.post({
				cid: 1,
				uid: 1,
				title: 'Another topic',
				content: 'This is flaggable content',
			});
			pid = result.postData.pid;
			tid = result.topicData.tid;
		});

		describe('.create()', () => {
			it('should create a flag with no errors', async () => {
				await request.post(`${nconf.get('url')}/api/v3/flags`, {
					jar,
					headers: {
						'x-csrf-token': csrfToken,
					},
					body: {
						type: 'post',
						id: pid,
						reason: 'foobar',
					},
				});
				const exists = await Flags.exists('post', pid, 2);
				assert(exists);
			});

			it('should escape flag reason', async () => {
				const postData = await Topics.reply({
					tid: tid,
					uid: 1,
					content: 'This is flaggable content',
				});
				const { body } = await request.post(`${nconf.get('url')}/api/v3/flags`, {
					jar,
					headers: {
						'x-csrf-token': csrfToken,
					},
					body: {
						type: 'post',
						id: postData.pid,
						reason: '"<script>alert(\'ok\');</script>',
					},
				});
				const flagData = await Flags.get(body.response.flagId);
				assert.strictEqual(flagData.reports[0].value, '&quot;&lt;script&gt;alert(&#x27;ok&#x27;);&lt;&#x2F;script&gt;');
			});

			it('should escape filters', async () => {
				const { body } = await request.get(`${nconf.get('url')}/api/flags?quick="<script>alert('foo');</script>`, { jar });
				assert.strictEqual(body.filters.quick, '&quot;&lt;script&gt;alert(&#x27;foo&#x27;);&lt;&#x2F;script&gt;');
			});

			it('should not allow flagging post in private category', async () => {
				const category = await Categories.create({ name: 'private category' });
				await Privileges.categories.rescind(['groups:topics:read'], category.cid, 'registered-users');
				await Groups.join('private category', uid3);
				const result = await Topics.post({
					cid: category.cid,
					uid: uid3,
					title: 'private topic',
					content: 'private post',
				});
				const login = await helpers.loginUser('unprivileged', 'abcdef');
				const jar3 = login.jar;
				const csrfToken = await helpers.getCsrfToken(jar3);
				const { response, body } = await request.post(`${nconf.get('url')}/api/v3/flags`, {
					jar: jar3,
					headers: {
						'x-csrf-token': csrfToken,
					},
					body: {
						type: 'post',
						id: result.postData.pid,
						reason: 'foobar',
					},
				});
				assert.strictEqual(response.statusCode, 403);
				delete body.stack;
				assert.deepStrictEqual(body, {
					status: {
						code: 'forbidden',
						message: 'You do not have enough privileges for this action.',
					},
					response: {},
				});
			});
		});

		describe('.update()', () => {
			it('should update a flag\'s properties', async () => {
				const { body } = await request.put(`${nconf.get('url')}/api/v3/flags/4`, {
					jar,
					headers: {
						'x-csrf-token': csrfToken,
					},
					body: {
						state: 'wip',
					},
				});
				const { history } = body.response;
				assert(Array.isArray(history));
				assert(history[0].fields.hasOwnProperty('state'));
				assert.strictEqual('[[flags:state-wip]]', history[0].fields.state);
			});
		});

		describe('.rescind()', () => {
			it('should remove a flag\'s report', async () => {
				const { response } = await request.del(`${nconf.get('url')}/api/v3/flags/4/report`, {
					jar,
					headers: {
						'x-csrf-token': csrfToken,
					},
				});
				assert.strictEqual(response.statusCode, 200);
			});
		});

		describe('.appendNote()', () => {
			it('should append a note to the flag', async () => {
				const { body } = await request.post(`${nconf.get('url')}/api/v3/flags/4/notes`, {
					jar,
					headers: {
						'x-csrf-token': csrfToken,
					},
					body: {
						note: 'lorem ipsum dolor sit amet',
						datetime: 1626446956652,
					},
				});
				const { response } = body;
				assert(response.hasOwnProperty('notes'));
				assert(Array.isArray(response.notes));
				assert.strictEqual('lorem ipsum dolor sit amet', response.notes[0].content);
				assert.strictEqual(2, response.notes[0].uid);
				assert(response.hasOwnProperty('history'));
				assert(Array.isArray(response.history));
				assert.strictEqual(1, Object.keys(response.history[response.history.length - 1].fields).length);
				assert(response.history[response.history.length - 1].fields.hasOwnProperty('notes'));
			});
		});

		describe('.deleteNote()', () => {
			it('should delete a note from a flag', async () => {
				const { body } = await request.del(`${nconf.get('url')}/api/v3/flags/4/notes/1626446956652`, {
					jar,
					headers: {
						'x-csrf-token': csrfToken,
					},
				});
				const { response } = body;
				assert(Array.isArray(response.history));
				assert(Array.isArray(response.notes));
				assert.strictEqual(response.notes.length, 0);
			});
		});

		describe('access control', () => {
			let uid;
			let jar;
			let csrf_token;
			let requests;
			let flaggerUid;
			let flagId;

			const noteTime = Date.now();

			before(async () => {
				uid = await User.create({ username: 'flags-access-control', password: 'abcdef' });
				({ jar, csrf_token } = await helpers.loginUser('flags-access-control', 'abcdef'));
				flaggerUid = await User.create({ username: 'flags-access-control-flagger', password: 'abcdef' });
			});

			beforeEach(async () => {
				// Reset uid back to unprivileged user
				await Groups.leave('administrators', uid);
				await Groups.leave('Global Moderators', uid);
				await Privileges.categories.rescind(['moderate'], 1, [uid]);

				const { postData } = await Topics.post({
					uid,
					cid: 1,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});

				({ flagId } = await Flags.create('post', postData.pid, flaggerUid, 'spam'));
				const commonOpts = {
					jar,
					headers: {
						'x-csrf-token': csrf_token,
					},
				};
				requests = new Set([
					{
						...commonOpts,
						method: 'get',
						uri: `${nconf.get('url')}/api/v3/flags/${flagId}`,
					},
					{
						...commonOpts,
						method: 'put',
						uri: `${nconf.get('url')}/api/v3/flags/${flagId}`,
						body: {
							state: 'wip',
						},
					},
					{
						...commonOpts,
						method: 'post',
						uri: `${nconf.get('url')}/api/v3/flags/${flagId}/notes`,
						body: {
							note: 'test note',
							datetime: noteTime,
						},
					},
					{
						...commonOpts,
						method: 'delete',
						uri: `${nconf.get('url')}/api/v3/flags/${flagId}/notes/${noteTime}`,
					},
					{
						...commonOpts,
						method: 'delete',
						uri: `${nconf.get('url')}/api/v3/flags/${flagId}`,
					},
				]);
			});

			it('should not allow access to privileged flag endpoints to guests', async () => {
				for (let opts of requests) {
					opts = { ...opts };
					delete opts.jar;
					delete opts.headers;
					const { response } = await request[opts.method](opts.uri, opts);
					const { statusCode } = response;
					assert(statusCode.toString().startsWith(4), `${opts.method.toUpperCase()} ${opts.uri} => ${statusCode}`);
				}
			});

			it('should not allow access to privileged flag endpoints to regular users', async () => {
				for (const opts of requests) {
					const { response } = await request[opts.method](opts.uri, opts);
					const { statusCode } = response;
					assert(statusCode.toString().startsWith(4), `${opts.method.toUpperCase()} ${opts.uri} => ${statusCode}`);
				}
			});

			it('should allow access to privileged endpoints to administrators', async () => {
				await Groups.join('administrators', uid);
				for (const opts of requests) {
					const { response } = await request[opts.method](opts.uri, opts);
					const { statusCode } = response;
					assert.strictEqual(statusCode, 200, `${opts.method.toUpperCase()} ${opts.uri} => ${statusCode}`);
				}
			});

			it('should allow access to privileged endpoints to global moderators', async () => {
				await Groups.join('Global Moderators', uid);
				for (const opts of requests) {
					const { response } = await request[opts.method](opts.uri, opts);
					const { statusCode } = response;
					assert.strictEqual(statusCode, 200, `${opts.method.toUpperCase()} ${opts.uri} => ${statusCode}`);
				}
			});

			it('should allow access to privileged endpoints to moderators if the flag target is a post in a cid they moderate', async () => {
				await Privileges.categories.give(['moderate'], 1, [uid]);
				for (const opts of requests) {
					const { response } = await request[opts.method](opts.uri, opts);
					const { statusCode } = response;
					assert.strictEqual(statusCode, 200, `${opts.method.toUpperCase()} ${opts.uri} => ${statusCode}`);
				}
			});

			it('should NOT allow access to privileged endpoints to moderators if the flag target is a post in a cid they DO NOT moderate', async () => {
				const { cid } = await Categories.create({
					name: utils.generateUUID(),
				});
				await Privileges.categories.give(['moderate'], cid, [uid]);
				for (const opts of requests) {
					const { response } = await request[opts.method](opts.uri, opts);
					const { statusCode } = response;
					assert(statusCode.toString().startsWith(4), `${opts.method.toUpperCase()} ${opts.uri} => ${statusCode}`);
				}
			});
		});


	});
});