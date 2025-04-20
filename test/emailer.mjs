'use strict';

import './cleanup.mjs';
import { SMTPServer } from 'smtp-server';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

import './mocks/databasemock.mjs';
import Plugins from '../src/plugins/index.js';
import Emailer from '../src/emailer.js';
import user from '../src/user/index.js';
import meta from '../src/meta/index.js';
import Meta from '../src/meta/index.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('emailer', () => {
	let onMail = function (address, session, callback) { callback(); };
	let onTo = function (address, session, callback) { callback(); };

	const template = 'test';
	const email = 'test@example.org';
	const language = 'en-GB';
	const params = {
		subject: 'Welcome to NodeBB',
	};

	const server = new SMTPServer({
		allowInsecureAuth: true,
		onAuth: function (auth, session, callback) {
			callback(null, {
				user: auth.username,
			});
		},
		onMailFrom: function (address, session, callback) {
			onMail(address, session, callback);
		},
		onRcptTo: function (address, session, callback) {
			onTo(address, session, callback);
		},
	});
	server.on('error', (err) => {
		throw err;
	});

	async function reset() {
		const filePath = path.join(__dirname, '../build/public/templates/emails/test.js');
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
		await Meta.configs.setMultiple({
			'email:smtpTransport:enabled': '0',
			'email:custom:test': '',
		});
	}
	before(async function () {
		server.listen(4000);
		await reset();
	});
	after(async function () {
		server.close();
		await reset();
	});

	// TODO: test sendmail here at some point

	it('plugin hook should work', (done) => {
		const error = new Error();
		const method = function (data, next) {
			assert(data);
			assert.equal(data.to, email);
			assert.equal(data.subject, `[NodeBB] ${params.subject}`);

			next(error);
		};

		Plugins.hooks.register('emailer-test', {
			hook: 'static:email.send',
			method,
		});

		Emailer.sendToEmail(template, email, language, params, (err) => {
			assert.equal(err, error);

			Plugins.hooks.unregister('emailer-test', 'static:email.send', method);
			done();
		});
	});

	it('should build custom template on config change', (done) => {
		const text = 'a random string of text';
		// make sure it's not already set
		Emailer.renderAndTranslate('test', {}, 'en-GB', (err, output) => {
			assert.ifError(err);

			assert.notEqual(output, text);

			Meta.configs.set('email:custom:test', text, (err) => {
				assert.ifError(err);

				// wait for pubsub stuff
				setTimeout(() => {
					Emailer.renderAndTranslate('test', {}, 'en-GB', (err, output) => {
						assert.ifError(err);

						assert.equal(output, text);
						done();
					});
				}, 2000);
			});
		});
	});

	it('should send via SMTP', (done) => {
		const from = 'admin@example.org';
		const username = 'another@example.com';

		onMail = function (address, session, callback) {
			assert.equal(address.address, from);
			assert.equal(session.user, username);

			callback();
		};

		onTo = function (address, session, callback) {
			assert.equal(address.address, email);

			callback();
			done();
		};

		Meta.configs.setMultiple({
			'email:smtpTransport:enabled': '1',
			'email:smtpTransport:user': username,
			'email:smtpTransport:pass': 'anything',
			'email:smtpTransport:service': 'nodebb-custom-smtp',
			'email:smtpTransport:port': 4000,
			'email:smtpTransport:host': 'localhost',
			'email:smtpTransport:security': 'NONE',
			'email:from': from,
		}, (err) => {
			assert.ifError(err);

			// delay so emailer has a chance to update after config changes
			setTimeout(() => {
				assert.equal(Emailer.fallbackTransport, Emailer.transports.smtp);

				Emailer.sendToEmail(template, email, language, params, (err) => {
					assert.ifError(err);
				});
			}, 200);
		});
	});

	describe('emailer.send()', () => {
		let recipientUid;

		before(async () => {
			recipientUid = await user.create({ username: 'recipient', email: 'test@example.org' });
			await user.email.confirmByUid(recipientUid);

			const method = async function () {
			};

			Plugins.hooks.register('emailer-test', {
				hook: 'static:email.send',
				method,
			});

			await user.bans.ban(recipientUid);

			Plugins.hooks.unregister('emailer-test', 'static:email.send', method);
		});

		after(async function () {
			await user.bans.unban(recipientUid);
		});

		it('should not send email to a banned user', async function () {
			const templatesSent = [];
			const method = async function ({ template }) {
				templatesSent.push(template);
			};

			Plugins.hooks.register('emailer-test', {
				hook: 'static:email.send',
				method,
			});

			await Emailer.send('test', recipientUid, {});

			Plugins.hooks.unregister('emailer-test', 'static:email.send', method);

			assert.deepStrictEqual(templatesSent, [], 'Email should not be sent to a banned user');
		});

		it('should return true if the template is "banned"', async function () {
			const templatesSent = [];
			const method = async function ({ template }) {
				templatesSent.push(template);
			};

			Plugins.hooks.register('emailer-test', {
				hook: 'static:email.send',
				method,
			});

			await Emailer.send('banned', recipientUid, {});
			Plugins.hooks.unregister('emailer-test', 'static:email.send', method);

			assert.deepStrictEqual(templatesSent, ["banned"], 'Email "banned" should be allowed to be sent to a banned user');
		});

		it('should return true if system settings allow sending to banned users', async () => {
			const templatesSent = [];
			const method = async function ({ template }) {
				templatesSent.push(template);
			};

			Plugins.hooks.register('emailer-test', {
				hook: 'static:email.send',
				method,
			});

			meta.config.sendEmailToBanned = 1;
			await Emailer.send('test', recipientUid, {});
			meta.config.sendEmailToBanned = 0;
			await Emailer.send('test', recipientUid, {});

			Plugins.hooks.unregister('emailer-test', 'static:email.send', method);
			assert.deepStrictEqual(templatesSent, ["test"], 'Email "test" should be sent to a banned user if system settings allow it');
		});
	});
});
