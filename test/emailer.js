'use strict';

var SMTPServer = require('smtp-server').SMTPServer;
var assert = require('assert');

var Plugins = require('../src/plugins');
var Emailer = require('../src/emailer');
var Meta = require('../src/meta');

describe('emailer', function () {
	var onMail = function (address, session, callback) { callback(); };
	var onTo = function (address, session, callback) { callback(); };

	var template = 'test';
	var email = 'test@example.org';
	var language = 'en-GB';
	var params = {
		subject: 'Welcome to NodeBB',
	};

	before(function (done) {
		var server = new SMTPServer({
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

		server.on('error', function (err) {
			throw err;
		});
		server.listen(4000, done);
	});

	// TODO: test sendmail here at some point

	it('plugin hook should work', function (done) {
		var error = new Error();

		Plugins.registerHook('emailer-test', {
			hook: 'filter:email.send',
			method: function (data, next) {
				assert(data);
				assert.equal(data.to, email);
				assert.equal(data.subject, params.subject);

				next(error);
			},
		});

		Emailer.sendToEmail(template, email, language, params, function (err) {
			assert.equal(err, error);

			Plugins.unregisterHook('emailer-test', 'filter:email.send');
			done();
		});
	});

	it('should send via SMTP', function (done) {
		var from = 'admin@example.org';
		var username = 'another@example.com';

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
			'email:smtpTransport:service': 'nodebb-custom-smtp',
			'email:smtpTransport:port': 4000,
			'email:smtpTransport:host': 'localhost',
			'email:smtpTransport:security': 'NONE',
			'email:from': from,
		}, function (err) {
			assert.ifError(err);

			// delay so emailer has a chance to update after config changes
			setTimeout(function () {
				assert.equal(Emailer.fallbackTransport, Emailer.transports.smtp);

				Emailer.sendToEmail(template, email, language, params, function (err) {
					assert.ifError(err);
				});
			}, 200);
		});
	});

	after(function (done) {
		Meta.configs.set('email:smtpTransport:enabled', '0', done);
	});
});
