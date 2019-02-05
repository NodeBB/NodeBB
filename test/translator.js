'use strict';


var assert = require('assert');
var shim = require('../public/src/modules/translator.js');
var Translator = shim.Translator;
var db = require('./mocks/databasemock');

describe('Translator shim', function () {
	describe('.translate()', function () {
		it('should translate correctly', function (done) {
			shim.translate('[[global:pagination.out_of, (foobar), [[global:home]]]]', function (translated) {
				assert.strictEqual(translated, '(foobar) out of Home');
				done();
			});
		});

		it('should accept a language parameter and adjust accordingly', function (done) {
			shim.translate('[[global:home]]', 'de', function (translated) {
				assert.strictEqual(translated, 'Übersicht');
				done();
			});
		});
	});
});

describe('new Translator(language)', function () {
	it('should throw if not passed a language', function (done) {
		assert.throws(function () {
			new Translator();
		}, /language string/);
		done();
	});

	describe('.translate()', function () {
		it('should handle basic translations', function () {
			var translator = Translator.create('en-GB');

			return translator.translate('[[global:home]]').then(function (translated) {
				assert.strictEqual(translated, 'Home');
			});
		});

		it('should handle language keys in regular text', function () {
			var translator = Translator.create('en-GB');

			return translator.translate('Let\'s go [[global:home]]').then(function (translated) {
				assert.strictEqual(translated, 'Let\'s go Home');
			});
		});

		it('should handle language keys in regular text with another language specified', function () {
			var translator = Translator.create('de');

			return translator.translate('[[global:home]] test').then(function (translated) {
				assert.strictEqual(translated, 'Übersicht test');
			});
		});

		it('should handle language keys with parameters', function () {
			var translator = Translator.create('en-GB');

			return translator.translate('[[global:pagination.out_of, 1, 5]]').then(function (translated) {
				assert.strictEqual(translated, '1 out of 5');
			});
		});

		it('should handle language keys inside language keys', function () {
			var translator = Translator.create('en-GB');

			return translator.translate('[[notifications:outgoing_link_message, [[global:guest]]]]').then(function (translated) {
				assert.strictEqual(translated, 'You are now leaving Guest');
			});
		});

		it('should handle language keys inside language keys with multiple parameters', function () {
			var translator = Translator.create('en-GB');

			return translator.translate('[[notifications:user_posted_to, [[global:guest]], My Topic]]').then(function (translated) {
				assert.strictEqual(translated, '<strong>Guest</strong> has posted a reply to: <strong>My Topic</strong>');
			});
		});

		it('should handle language keys inside language keys with all parameters as language keys', function () {
			var translator = Translator.create('en-GB');

			return translator.translate('[[notifications:user_posted_to, [[global:guest]], [[global:guest]]]]').then(function (translated) {
				assert.strictEqual(translated, '<strong>Guest</strong> has posted a reply to: <strong>Guest</strong>');
			});
		});

		it('should properly handle parameters that contain square brackets', function () {
			var translator = Translator.create('en-GB');

			return translator.translate('[[global:pagination.out_of, [guest], [[global:home]]]]').then(function (translated) {
				assert.strictEqual(translated, '[guest] out of Home');
			});
		});

		it('should properly handle parameters that contain parentheses', function () {
			var translator = Translator.create('en-GB');

			return translator.translate('[[global:pagination.out_of, (foobar), [[global:home]]]]').then(function (translated) {
				assert.strictEqual(translated, '(foobar) out of Home');
			});
		});

		it('should escape language key parameters with HTML in them', function () {
			var translator = Translator.create('en-GB');

			var key = '[[global:403.login, <strong>test</strong>]]';
			return translator.translate(key).then(function (translated) {
				assert.strictEqual(translated, 'Perhaps you should <a href=\'&lt;strong&gt;test&lt;/strong&gt;/login\'>try logging in</a>?');
			});
		});

		it('should not unescape html in parameters', function () {
			var translator = Translator.create('en-GB');

			var key = '[[pages:tag, some&amp;tag]]';
			return translator.translate(key).then(function (translated) {
				assert.strictEqual(translated, 'Topics tagged under &quot;some&amp;tag&quot;');
			});
		});

		it('should properly escape and ignore % and \\, in arguments', function () {
			var translator = Translator.create('en-GB');

			var title = 'Test 1\\, 2\\, 3 %2 salmon';
			var key = '[[topic:composer.replying_to, ' + title + ']]';
			return translator.translate(key).then(function (translated) {
				assert.strictEqual(translated, 'Replying to Test 1&#44; 2&#44; 3 &#37;2 salmon');
			});
		});

		it('should not escape regular %', function () {
			var translator = Translator.create('en-GB');

			var title = '3 % salmon';
			var key = '[[topic:composer.replying_to, ' + title + ']]';
			return translator.translate(key).then(function (translated) {
				assert.strictEqual(translated, 'Replying to 3 % salmon');
			});
		});

		it('should not translate [[derp] some text', function () {
			var translator = Translator.create('en-GB');
			return translator.translate('[[derp] some text').then(function (translated) {
				assert.strictEqual('[[derp] some text', translated);
			});
		});

		it('should not translate [[derp]] some text', function () {
			var translator = Translator.create('en-GB');
			return translator.translate('[[derp]] some text').then(function (translated) {
				assert.strictEqual('[[derp]] some text', translated);
			});
		});

		it('should not translate [[derp:xyz] some text', function () {
			var translator = Translator.create('en-GB');
			return translator.translate('[[derp:xyz] some text').then(function (translated) {
				assert.strictEqual('[[derp:xyz] some text', translated);
			});
		});

		it('should translate keys with slashes properly', function () {
			var translator = Translator.create('en-GB');
			return translator.translate('[[pages:users/latest]]').then(function (translated) {
				assert.strictEqual(translated, 'Latest Users');
			});
		});

		it('should use key for unknown keys without arguments', function () {
			var translator = Translator.create('en-GB');
			return translator.translate('[[unknown:key.without.args]]').then(function (translated) {
				assert.strictEqual(translated, 'key.without.args');
			});
		});

		it('should use backup for unknown keys with arguments', function () {
			var translator = Translator.create('en-GB');
			return translator.translate('[[unknown:key.with.args, arguments are here, derpity, derp]]').then(function (translated) {
				assert.strictEqual(translated, 'unknown:key.with.args, arguments are here, derpity, derp');
			});
		});

		it('should ignore unclosed tokens', function () {
			var translator = Translator.create('en-GB');
			return translator.translate('here is some stuff and other things [[abc:xyz, other random stuff should be fine here [[global:home]] and more things [[pages:users/latest]]').then(function (translated) {
				assert.strictEqual(translated, 'here is some stuff and other things abc:xyz, other random stuff should be fine here Home and more things Latest Users');
			});
		});
	});
});

describe('Translator.create()', function () {
	it('should return an instance of Translator', function (done) {
		var translator = Translator.create('en-GB');

		assert(translator instanceof Translator);
		done();
	});
	it('should return the same object for the same language', function (done) {
		var one = Translator.create('de');
		var two = Translator.create('de');

		assert.strictEqual(one, two);
		done();
	});
	it('should default to defaultLang', function (done) {
		var translator = Translator.create();

		assert.strictEqual(translator.lang, 'en-GB');
		done();
	});
});

describe('Translator modules', function () {
	it('should work before registered', function () {
		var translator = Translator.create();

		Translator.registerModule('test-custom-integer-format', function (lang) {
			return function (key, args) {
				var num = parseInt(args[0], 10) || 0;
				if (key === 'binary') {
					return num.toString(2);
				}
				if (key === 'hex') {
					return num.toString(16);
				}
				if (key === 'octal') {
					return num.toString(8);
				}
				return num.toString();
			};
		});

		return translator.translate('[[test-custom-integer-format:octal, 24]]').then(function (translation) {
			assert.strictEqual(translation, '30');
		});
	});

	it('should work after registered', function () {
		var translator = Translator.create('de');

		return translator.translate('[[test-custom-integer-format:octal, 23]]').then(function (translation) {
			assert.strictEqual(translation, '27');
		});
	});

	it('registerModule be passed the language', function (done) {
		Translator.registerModule('something', function (lang) {
			assert.ok(lang);
		});

		var translator = Translator.create('fr_FR');
		done();
	});
});

describe('Translator static methods', function () {
	describe('.removePatterns', function () {
		it('should remove translator patterns from text', function (done) {
			assert.strictEqual(
				Translator.removePatterns('Lorem ipsum dolor [[sit:amet]], consectetur adipiscing elit. [[sed:vitae, [[semper:dolor]]]] lorem'),
				'Lorem ipsum dolor , consectetur adipiscing elit.  lorem'
			);
			done();
		});
	});
	describe('.escape', function () {
		it('should escape translation patterns within text', function (done) {
			assert.strictEqual(
				Translator.escape('some nice text [[global:home]] here'),
				'some nice text &lsqb;&lsqb;global:home&rsqb;&rsqb; here'
			);
			done();
		});
	});

	describe('.unescape', function () {
		it('should unescape escaped translation patterns within text', function (done) {
			assert.strictEqual(
				Translator.unescape('some nice text \\[\\[global:home\\]\\] here'),
				'some nice text [[global:home]] here'
			);
			assert.strictEqual(
				Translator.unescape('some nice text &lsqb;&lsqb;global:home&rsqb;&rsqb; here'),
				'some nice text [[global:home]] here'
			);
			done();
		});
	});

	describe('.compile', function () {
		it('should create a translator pattern from a key and list of arguments', function (done) {
			assert.strictEqual(
				Translator.compile('amazing:cool', 'awesome', 'great'),
				'[[amazing:cool, awesome, great]]'
			);
			done();
		});

		it('should escape `%` and `,` in arguments', function (done) {
			assert.strictEqual(
				Translator.compile('amazing:cool', '100% awesome!', 'one, two, and three'),
				'[[amazing:cool, 100&#37; awesome!, one&#44; two&#44; and three]]'
			);
			done();
		});
	});
});
