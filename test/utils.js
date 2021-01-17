'use strict';


const assert = require('assert');
const { JSDOM } = require('jsdom');
const utils = require('../public/src/utils.js');
const slugify = require('../src/slugify');
const db = require('./mocks/databasemock');

describe('Utility Methods', () => {
	// https://gist.github.com/robballou/9ee108758dc5e0e2d028
	// create some jsdom magic to allow jQuery to work
	const dom = new JSDOM('<html><body></body></html>');
	const { window } = dom;
	global.window = window;
	global.jQuery = require('jquery');
	global.$ = global.jQuery;
	const { $ } = global;
	require('jquery-deserialize');
	require('jquery-serializeobject');

	it('should serialize/deserialize form data properly', () => {
		const formSerialize = $(`
			<form id="form-serialize">
				<input name="a" value="1">
				<input name="a" value="2">
				<input name="bar" value="test">
				<input name="check1" type="checkbox" checked>
				<input name="check2" type="checkbox">
			</form>
		`);
		const sampleData = {
			a: ['1', '2'],
			bar: 'test',
			check1: 'on',
		};
		const data = formSerialize.serializeObject();
		assert.deepStrictEqual(data, sampleData);

		const formDeserialize = $(`
			<form>
				<input id="input1" name="a"/>
				<input id="input2" name="a"/>
				<input id="input3" name="bar"/>
				<input id="input4" name="check1" type="checkbox">
				<input id="input5" name="check2" type="checkbox">
			</form>
		`);

		formDeserialize.deserialize(sampleData);
		assert.strictEqual(formDeserialize.find('#input1').val(), sampleData.a[0]);
		assert.strictEqual(formDeserialize.find('#input2').val(), sampleData.a[1]);
		assert.strictEqual(formDeserialize.find('#input3').val(), sampleData.bar);
		assert.strictEqual(formDeserialize.find('#input4').prop('checked'), true);
		assert.strictEqual(formDeserialize.find('#input5').prop('checked'), false);
	});

	// https://github.com/jprichardson/string.js/blob/master/test/string.test.js
	it('should decode HTML entities', (done) => {
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
	it('should strip HTML tags', (done) => {
		assert.strictEqual(utils.stripHTMLTags('<p>just <b>some</b> text</p>'), 'just some text');
		assert.strictEqual(utils.stripHTMLTags('<p>just <b>some</b> text</p>', ['p']), 'just <b>some</b> text');
		assert.strictEqual(utils.stripHTMLTags('<i>just</i> some <image/> text', ['i']), 'just some <image/> text');
		assert.strictEqual(utils.stripHTMLTags('<i>just</i> some <image/> <div>text</div>', ['i', 'div']), 'just some <image/> text');
		done();
	});

	it('should preserve case if requested', (done) => {
		assert.strictEqual(slugify('UPPER CASE', true), 'UPPER-CASE');
		done();
	});

	it('should work if a number is passed in', (done) => {
		assert.strictEqual(slugify(12345), '12345');
		done();
	});

	describe('username validation', () => {
		it('accepts latin-1 characters', () => {
			const username = "John\"'-. Doeäâèéë1234";
			assert(utils.isUserNameValid(username), 'invalid username');
		});

		it('rejects empty string', () => {
			const username = '';
			assert.equal(utils.isUserNameValid(username), false, 'accepted as valid username');
		});

		it('should reject new lines', () => {
			assert.equal(utils.isUserNameValid('myusername\r\n'), false);
		});

		it('should reject new lines', () => {
			assert.equal(utils.isUserNameValid('myusername\n'), false);
		});

		it('should reject tabs', () => {
			assert.equal(utils.isUserNameValid('myusername\t'), false);
		});

		it('accepts square brackets', () => {
			const username = '[best clan] julian';
			assert(utils.isUserNameValid(username), 'invalid username');
		});

		it('accepts regular username', () => {
			assert(utils.isUserNameValid('myusername'), 'invalid username');
		});

		it('accepts quotes', () => {
			assert(utils.isUserNameValid('baris "the best" usakli'), 'invalid username');
		});
	});

	describe('email validation', () => {
		it('accepts sample address', () => {
			const email = 'sample@example.com';
			assert(utils.isEmailValid(email), 'invalid email');
		});
		it('rejects empty address', () => {
			const email = '';
			assert.equal(utils.isEmailValid(email), false, 'accepted as valid email');
		});
	});

	describe('UUID generation', () => {
		it('return unique random value every time', () => {
			const uuid1 = utils.generateUUID();
			const uuid2 = utils.generateUUID();
			assert.notEqual(uuid1, uuid2, 'matches');
		});
	});

	describe('cleanUpTag', () => {
		it('should cleanUp a tag', (done) => {
			const cleanedTag = utils.cleanUpTag(',/#!$%^*;TaG1:{}=_`<>\'"~()?|');
			assert.equal(cleanedTag, 'tag1');
			done();
		});

		it('should return empty string for invalid tags', (done) => {
			assert.strictEqual(utils.cleanUpTag(undefined), '');
			assert.strictEqual(utils.cleanUpTag(null), '');
			assert.strictEqual(utils.cleanUpTag(false), '');
			assert.strictEqual(utils.cleanUpTag(1), '');
			assert.strictEqual(utils.cleanUpTag(0), '');
			done();
		});
	});

	it('should remove punctuation', (done) => {
		const removed = utils.removePunctuation('some text with , ! punctuation inside "');
		assert.equal(removed, 'some text with   punctuation inside ');
		done();
	});

	it('should return true if string has language key', (done) => {
		assert.equal(utils.hasLanguageKey('some text [[topic:title]] and [[user:reputaiton]]'), true);
		done();
	});

	it('should return false if string does not have language key', (done) => {
		assert.equal(utils.hasLanguageKey('some text with no language keys'), false);
		done();
	});

	it('should shallow merge two objects', (done) => {
		const a = { foo: 1, cat1: 'ginger' };
		const b = { baz: 2, cat2: 'phoebe' };
		const obj = utils.merge(a, b);
		assert.strictEqual(obj.foo, 1);
		assert.strictEqual(obj.baz, 2);
		assert.strictEqual(obj.cat1, 'ginger');
		assert.strictEqual(obj.cat2, 'phoebe');
		done();
	});

	it('should return the file extesion', (done) => {
		assert.equal(utils.fileExtension('/path/to/some/file.png'), 'png');
		done();
	});

	it('should return file mime type', (done) => {
		assert.equal(utils.fileMimeType('/path/to/some/file.png'), 'image/png');
		done();
	});

	it('should check if url is relative', (done) => {
		assert.equal(utils.isRelativeUrl('/topic/1/slug'), true);
		done();
	});

	it('should check if url is relative', (done) => {
		assert.equal(utils.isRelativeUrl('https://nodebb.org'), false);
		done();
	});

	it('should make number human readable', (done) => {
		assert.equal(utils.makeNumberHumanReadable('1000'), '1.0k');
		done();
	});

	it('should make number human readable', (done) => {
		assert.equal(utils.makeNumberHumanReadable('1100000'), '1.1m');
		done();
	});

	it('should make number human readable', (done) => {
		assert.equal(utils.makeNumberHumanReadable('100'), '100');
		done();
	});

	it('should make number human readable', (done) => {
		assert.equal(utils.makeNumberHumanReadable(null), null);
		done();
	});

	it('should make numbers human readable on elements', (done) => {
		const el = $('<div title="100000"></div>');
		utils.makeNumbersHumanReadable(el);
		assert.equal(el.html(), '100.0k');
		done();
	});

	it('should add commas to numbers', (done) => {
		assert.equal(utils.addCommas('100'), '100');
		done();
	});

	it('should add commas to numbers', (done) => {
		assert.equal(utils.addCommas('1000'), '1,000');
		done();
	});

	it('should add commas to numbers', (done) => {
		assert.equal(utils.addCommas('1000000'), '1,000,000');
		done();
	});

	it('should add commas to elements', (done) => {
		const el = $('<div>1000000</div>');
		utils.addCommasToNumbers(el);
		assert.equal(el.html(), '1,000,000');
		done();
	});

	it('should return passed in value if invalid', (done) => {
		const bigInt = -111111111111111111;
		const result = utils.toISOString(bigInt);
		assert.equal(bigInt, result);
		done();
	});

	it('should return false if browser is not android', (done) => {
		global.navigator = {
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.96 Safari/537.36',
		};
		assert.equal(utils.isAndroidBrowser(), false);
		done();
	});

	it('should return true if browser is android', (done) => {
		global.navigator = {
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Android /58.0.3029.96 Safari/537.36',
		};
		assert.equal(utils.isAndroidBrowser(), true);
		done();
	});

	it('should return false if not touch device', (done) => {
		global.document = global.document || {};
		global.document.documentElement = {};
		assert(!utils.isTouchDevice());
		done();
	});

	it('should return true if touch device', (done) => {
		global.document.documentElement = {
			ontouchstart: 1,
		};
		assert(utils.isTouchDevice());
		done();
	});

	it('should check if element is in viewport', (done) => {
		const el = $('<div>some text</div>');
		assert(utils.isElementInViewport(el));
		done();
	});

	it('should get empty object for url params', (done) => {
		global.document = window.document;
		const params = utils.params();
		assert.equal(Object.keys(params), 0);
		done();
	});

	it('should get url params', (done) => {
		const params = utils.params({ url: 'http://nodebb.org?foo=1&bar=test&herp=2' });
		assert.equal(params.foo, 1);
		assert.equal(params.bar, 'test');
		assert.equal(params.herp, 2);
		done();
	});

	it('should get a single param', (done) => {
		assert.equal(utils.param('somekey'), undefined);
		done();
	});


	describe('toType', () => {
		it('should return param as is if not string', (done) => {
			assert.equal(123, utils.toType(123));
			done();
		});

		it('should convert return string numbers as numbers', (done) => {
			assert.equal(123, utils.toType('123'));
			done();
		});

		it('should convert string "false" to boolean false', (done) => {
			assert.strictEqual(false, utils.toType('false'));
			done();
		});

		it('should convert string "true" to boolean true', (done) => {
			assert.strictEqual(true, utils.toType('true'));
			done();
		});

		it('should parse json', (done) => {
			const data = utils.toType('{"a":"1"}');
			assert.equal(data.a, '1');
			done();
		});

		it('should return string as is if its not json,true,false or number', (done) => {
			const regularStr = 'this is a regular string';
			assert.equal(regularStr, utils.toType(regularStr));
			done();
		});
	});

	describe('utils.props', () => {
		const data = {};

		it('should set nested data', (done) => {
			assert.equal(10, utils.props(data, 'a.b.c.d', 10));
			done();
		});

		it('should return nested object', (done) => {
			const obj = utils.props(data, 'a.b.c');
			assert.equal(obj.d, 10);
			done();
		});

		it('should returned undefined without throwing', (done) => {
			assert.equal(utils.props(data, 'a.b.c.foo.bar'), undefined);
			done();
		});

		it('should return undefined if second param is null', (done) => {
			assert.equal(utils.props(undefined, null), undefined);
			done();
		});
	});

	describe('isInternalURI', () => {
		const target = { host: '', protocol: 'https' };
		const reference = { host: '', protocol: 'https' };

		it('should return true if they match', (done) => {
			assert(utils.isInternalURI(target, reference, ''));
			done();
		});

		it('should return true if they match', (done) => {
			target.host = 'nodebb.org';
			reference.host = 'nodebb.org';
			assert(utils.isInternalURI(target, reference, ''));
			done();
		});

		it('should handle relative path', (done) => {
			target.pathname = '/forum';
			assert(utils.isInternalURI(target, reference, '/forum'));
			done();
		});

		it('should return false if they do not match', (done) => {
			target.pathname = '';
			reference.host = 'designcreateplay.com';
			assert(!utils.isInternalURI(target, reference));
			done();
		});
	});

	it('escape html', (done) => {
		const escaped = utils.escapeHTML('&<>');
		assert.equal(escaped, '&amp;&lt;&gt;');
		done();
	});

	it('should escape regex chars', (done) => {
		const escaped = utils.escapeRegexChars('some text {}');
		assert.equal(escaped, 'some\\ text\\ \\{\\}');
		done();
	});

	it('should get hours array', (done) => {
		const currentHour = new Date().getHours();
		const hours = utils.getHoursArray();
		let index = hours.length - 1;
		for (let i = currentHour, ii = currentHour - 24; i > ii; i -= 1) {
			const hour = i < 0 ? 24 + i : i;
			assert.equal(hours[index], `${hour}:00`);
			index -= 1;
		}
		done();
	});

	it('should get days array', (done) => {
		const currentDay = new Date(Date.now()).getTime();
		const days = utils.getDaysArray();
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		let index = 0;
		for (let x = 29; x >= 0; x -= 1) {
			const tmpDate = new Date(currentDay - (1000 * 60 * 60 * 24 * x));
			assert.equal(`${months[tmpDate.getMonth()]} ${tmpDate.getDate()}`, days[index]);
			index += 1;
		}
		done();
	});

	it('`utils.rtrim` should remove trailing space', (done) => {
		assert.strictEqual(utils.rtrim('  thing   '), '  thing');
		assert.strictEqual(utils.rtrim('\tthing\t\t'), '\tthing');
		assert.strictEqual(utils.rtrim('\t thing \t'), '\t thing');
		done();
	});

	it('should profile function', (done) => {
		const st = process.hrtime();
		setTimeout(() => {
			process.profile('it took', st);
			done();
		}, 500);
	});

	it('should return object with data', async () => {
		const user = require('../src/user');
		const uid1 = await user.create({ username: 'promise1' });
		const uid2 = await user.create({ username: 'promise2' });
		const result = await utils.promiseParallel({
			user1: user.getUserData(uid1),
			user2: user.getUserData(uid2),
		});
		assert(result.hasOwnProperty('user1') && result.hasOwnProperty('user2'));
		assert.strictEqual(result.user1.uid, uid1);
		assert.strictEqual(result.user2.uid, uid2);
	});
});
