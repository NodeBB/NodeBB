'use strict';


var assert = require('assert');
var utils = require('./../public/src/utils.js');


describe('Utility Methods', function () {
	describe('username validation', function () {
		it('accepts latin-1 characters', function () {
			var username = "John\"'-. Doeäâèéë1234";
			assert(utils.isUserNameValid(username), 'invalid username');
		});
		it('rejects empty string', function () {
			var username = '';
			assert.ifError(utils.isUserNameValid(username), 'accepted as valid username');
		});
	});

	describe('email validation', function () {
		it('accepts sample address', function () {
			var email = 'sample@example.com';
			assert(utils.isEmailValid(email), 'invalid email');
		});
		it('rejects empty address', function () {
			var email = '';
			assert.ifError(utils.isEmailValid(email), 'accepted as valid email');
		});
	});

	describe('UUID generation', function () {
		it('return unique random value every time', function () {
			var uuid1 = utils.generateUUID();
			var uuid2 = utils.generateUUID();
			assert.notEqual(uuid1, uuid2, 'matches');
		});
	});

	describe('cleanUpTag', function () {
		it('should cleanUp a tag', function (done) {
			var cleanedTag = utils.cleanUpTag(',\/#!$%\^\*;TaG1:{}=_`<>\'"~()?\|');
			assert.equal(cleanedTag, 'tag1');
			done();
		});

		it('should return empty string for invalid tags', function (done) {
			assert.strictEqual(utils.cleanUpTag(undefined), '');
			assert.strictEqual(utils.cleanUpTag(null), '');
			assert.strictEqual(utils.cleanUpTag(false), '');
			assert.strictEqual(utils.cleanUpTag(1), '');
			assert.strictEqual(utils.cleanUpTag(0), '');
			done();
		});
	});

	it('should remove punctuation', function (done) {
		var removed = utils.removePunctuation('some text with , ! punctuation inside "');
		assert.equal(removed, 'some text with   punctuation inside ');
		done();
	});

	it('should return true if string has language key', function (done) {
		assert.equal(utils.hasLanguageKey('some text [[topic:title]] and [[user:reputaiton]]'), true);
		done();
	});

	it('should return false if string does not have language key', function (done) {
		assert.equal(utils.hasLanguageKey('some text with no language keys'), false);
		done();
	});

	it('should shallow merge two objects', function (done) {
		var a = {foo: 1, cat1: 'ginger'};
		var b = {baz: 2, cat2: 'phoebe'};
		var obj = utils.merge(a, b);
		assert.strictEqual(obj.foo, 1);
		assert.strictEqual(obj.baz, 2);
		assert.strictEqual(obj.cat1, 'ginger');
		assert.strictEqual(obj.cat2, 'phoebe');
		done();
	});

	it('should return the file extesion', function (done) {
		assert.equal(utils.fileExtension('/path/to/some/file.png'), 'png');
		done();
	});

	it('should return file mime type', function (done) {
		assert.equal(utils.fileMimeType('/path/to/some/file.png'), 'image/png');
		done();
	});

	it('should check if url is relative', function (done) {
		assert.equal(utils.isRelativeUrl('/topic/1/slug'), true);
		done();
	});

	it('should check if url is relative', function (done) {
		assert.equal(utils.isRelativeUrl('https://nodebb.org'), false);
		done();
	});

	it('should make number human readable', function (done) {
		assert.equal(utils.makeNumberHumanReadable('1000'), '1.0k');
		done();
	});

	it('should make number human readable', function (done) {
		assert.equal(utils.makeNumberHumanReadable('1100000'), '1.1m');
		done();
	});

	it('should make number human readable', function (done) {
		assert.equal(utils.makeNumberHumanReadable('100'), '100');
		done();
	});

	it('should make number human readable', function (done) {
		assert.equal(utils.makeNumberHumanReadable(null), null);
		done();
	});

	it('should add commas to numbers', function (done) {
		assert.equal(utils.addCommas('100'), '100');
		done();
	});

	it('should add commas to numbers', function (done) {
		assert.equal(utils.addCommas('1000'), '1,000');
		done();
	});

	it('should add commas to numbers', function (done) {
		assert.equal(utils.addCommas('1000000'), '1,000,000');
		done();
	});

	it('escape html', function (done) {
		var escaped = utils.escapeHTML('&<>');
		assert.equal(escaped, '&amp;&lt;&gt;');
		done();
	});

	it('should escape regex chars', function (done) {
		var escaped = utils.escapeRegexChars('some text {}');
		assert.equal(escaped, 'some\\ text\\ \\{\\}');
		done();
	});

	it('should get hours array', function (done) {
		var currentHour = new Date().getHours();
		var hours = utils.getHoursArray();
		var index = hours.length - 1;
		for (var i = currentHour, ii = currentHour - 24; i > ii; i -= 1) {
			var hour = i < 0 ? 24 + i : i;
			assert.equal(hours[index], hour + ':00');
			index -= 1;
		}
		done();
	});

	it('should get days array', function (done) {
		var currentDay = new Date(Date.now()).getTime();
		var days = utils.getDaysArray();
		var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		var index = 0;
		for (var x = 29; x >= 0; x -= 1) {
			var tmpDate = new Date(currentDay - (1000 * 60 * 60 * 24 * x));
			assert.equal(months[tmpDate.getMonth()] + ' ' + tmpDate.getDate(), days[index]);
			index += 1;
		}
		done();
	});

});
