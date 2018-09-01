'use strict';


var assert = require('assert');
var JSDOM = require('jsdom').JSDOM;
var utils = require('./../public/src/utils.js');


describe('Utility Methods', function () {
	// https://gist.github.com/robballou/9ee108758dc5e0e2d028
	// create some jsdom magic to allow jQuery to work
	var dom = new JSDOM('<html><body></body></html>');
	var window = dom.window;
	global.jQuery = require('jquery')(window);
	global.$ = global.jQuery;
	var $ = global.$;
	global.window = window;

	// https://github.com/jprichardson/string.js/blob/master/test/string.test.js
	it('should decode HTML entities', function (done) {
		assert.strictEqual(
			utils.decodeHTMLEntities('Ken Thompson &amp; Dennis Ritchie'),
			'Ken Thompson & Dennis Ritchie'
		);
		assert.strictEqual(
			utils.decodeHTMLEntities('3 &lt; 4'),
			'3 < 4'
		);
		assert.strictEqual(
			utils.decodeHTMLEntities('http:&#47;&#47;'),
			'http://'
		);
		done();
	});
	it('should strip HTML tags', function (done) {
		assert.strictEqual(utils.stripHTMLTags('<p>just <b>some</b> text</p>'), 'just some text');
		assert.strictEqual(utils.stripHTMLTags('<p>just <b>some</b> text</p>', ['p']), 'just <b>some</b> text');
		assert.strictEqual(utils.stripHTMLTags('<i>just</i> some <image/> text', ['i']), 'just some <image/> text');
		assert.strictEqual(utils.stripHTMLTags('<i>just</i> some <image/> <div>text</div>', ['i', 'div']), 'just some <image/> text');
		done();
	});

	it('should preserve case if requested', function (done) {
		var slug = utils.slugify('UPPER CASE', true);
		assert.equal(slug, 'UPPER-CASE');
		done();
	});

	describe('username validation', function () {
		it('accepts latin-1 characters', function () {
			var username = "John\"'-. Doeäâèéë1234";
			assert(utils.isUserNameValid(username), 'invalid username');
		});
		it('rejects empty string', function () {
			var username = '';
			assert.equal(utils.isUserNameValid(username), false, 'accepted as valid username');
		});
	});

	describe('email validation', function () {
		it('accepts sample address', function () {
			var email = 'sample@example.com';
			assert(utils.isEmailValid(email), 'invalid email');
		});
		it('rejects empty address', function () {
			var email = '';
			assert.equal(utils.isEmailValid(email), false, 'accepted as valid email');
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
			var cleanedTag = utils.cleanUpTag(',/#!$%^*;TaG1:{}=_`<>\'"~()?|');
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
		var a = { foo: 1, cat1: 'ginger' };
		var b = { baz: 2, cat2: 'phoebe' };
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

	it('should make numbers human readable on elements', function (done) {
		var el = $('<div title="100000"></div>');
		utils.makeNumbersHumanReadable(el);
		assert.equal(el.html(), '100.0k');
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

	it('should add commas to elements', function (done) {
		var el = $('<div>1000000</div>');
		utils.addCommasToNumbers(el);
		assert.equal(el.html(), '1,000,000');
		done();
	});

	it('should return passed in value if invalid', function (done) {
		var bigInt = -111111111111111111;
		var result = utils.toISOString(bigInt);
		assert.equal(bigInt, result);
		done();
	});

	it('should return false if browser is not android', function (done) {
		global.navigator = {
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.96 Safari/537.36',
		};
		assert.equal(utils.isAndroidBrowser(), false);
		done();
	});

	it('should return true if browser is android', function (done) {
		global.navigator = {
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Android /58.0.3029.96 Safari/537.36',
		};
		assert.equal(utils.isAndroidBrowser(), true);
		done();
	});

	it('should return false if not touch device', function (done) {
		global.document = global.document || {};
		global.document.documentElement = {};
		assert(!utils.isTouchDevice());
		done();
	});

	it('should return true if touch device', function (done) {
		global.document.documentElement = {
			ontouchstart: 1,
		};
		assert(utils.isTouchDevice());
		done();
	});

	it('should check if element is in viewport', function (done) {
		var el = $('<div>some text</div>');
		assert(utils.isElementInViewport(el));
		done();
	});

	it('should get empty object for url params', function (done) {
		var params = utils.params();
		assert.equal(Object.keys(params), 0);
		done();
	});

	it('should get url params', function (done) {
		var params = utils.params({ url: 'http://nodebb.org?foo=1&bar=test&herp=2' });
		assert.equal(params.foo, 1);
		assert.equal(params.bar, 'test');
		assert.equal(params.herp, 2);
		done();
	});

	it('should get a single param', function (done) {
		assert.equal(utils.param('somekey'), undefined);
		done();
	});


	describe('toType', function () {
		it('should return param as is if not string', function (done) {
			assert.equal(123, utils.toType(123));
			done();
		});

		it('should convert return string numbers as numbers', function (done) {
			assert.equal(123, utils.toType('123'));
			done();
		});

		it('should convert string "false" to boolean false', function (done) {
			assert.strictEqual(false, utils.toType('false'));
			done();
		});

		it('should convert string "true" to boolean true', function (done) {
			assert.strictEqual(true, utils.toType('true'));
			done();
		});

		it('should parse json', function (done) {
			var data = utils.toType('{"a":"1"}');
			assert.equal(data.a, '1');
			done();
		});

		it('should return string as is if its not json,true,false or number', function (done) {
			var regularStr = 'this is a regular string';
			assert.equal(regularStr, utils.toType(regularStr));
			done();
		});
	});

	describe('utils.props', function () {
		var data = {};

		it('should set nested data', function (done) {
			assert.equal(10, utils.props(data, 'a.b.c.d', 10));
			done();
		});

		it('should return nested object', function (done) {
			var obj = utils.props(data, 'a.b.c');
			assert.equal(obj.d, 10);
			done();
		});

		it('should returned undefined without throwing', function (done) {
			assert.equal(utils.props(data, 'a.b.c.foo.bar'), undefined);
			done();
		});

		it('should return undefined if second param is null', function (done) {
			assert.equal(utils.props(undefined, null), undefined);
			done();
		});
	});

	describe('isInternalURI', function () {
		var target = { host: '', protocol: 'https' };
		var reference = { host: '', protocol: 'https' };

		it('should return true if they match', function (done) {
			assert(utils.isInternalURI(target, reference, ''));
			done();
		});

		it('should return true if they match', function (done) {
			target.host = 'nodebb.org';
			reference.host = 'nodebb.org';
			assert(utils.isInternalURI(target, reference, ''));
			done();
		});

		it('should handle relative path', function (done) {
			target.pathname = '/forum';
			assert(utils.isInternalURI(target, reference, '/forum'));
			done();
		});

		it('should return false if they do not match', function (done) {
			target.pathname = '';
			reference.host = 'designcreateplay.com';
			assert(!utils.isInternalURI(target, reference));
			done();
		});
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

	it('`utils.rtrim` should remove trailing space', function (done) {
		assert.strictEqual(utils.rtrim('  thing   '), '  thing');
		assert.strictEqual(utils.rtrim('\tthing\t\t'), '\tthing');
		assert.strictEqual(utils.rtrim('\t thing \t'), '\t thing');
		done();
	});

	it('should walk directory', function (done) {
		utils.walk(__dirname, function (err, data) {
			assert.ifError(err);
			assert(Array.isArray(data));
			done();
		});
	});

	it('should profile function', function (done) {
		var st = process.hrtime();
		setTimeout(function () {
			process.profile('it took', st);
			done();
		}, 500);
	});
});
