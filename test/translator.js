'use strict';
/*global require*/

var assert = require('assert');
var shim = require('../public/src/modules/translator.js');
var Translator = shim.Translator;

require('../src/languages').init(function () {});

describe('translator shim', function (){
	describe('.translate()', function (){
		it('should translate correctly', function (done) {
			shim.translate('[[global:pagination.out_of, (foobar), [[global:home]]]]', function (translated) {
				assert.strictEqual(translated, '(foobar) out of Home');
				done();
			});
		});
	});
});

describe('new Translator(language)', function (){
	describe('.translate()', function (){
		it('should handle basic translations', function (done) {
            var translator = new Translator('en_GB');

			translator.translate('[[global:home]]').then(function (translated) {
				assert.strictEqual(translated, 'Home');
				done();
			});
		});

		it('should handle language keys in regular text', function (done) {
            var translator = new Translator('en_GB');

			translator.translate('Let\'s go [[global:home]]').then(function (translated) {
				assert.strictEqual(translated, 'Let\'s go Home');
				done();
			});
		});

		it('should accept a language parameter and adjust accordingly', function (done) {
            var translator = new Translator('de');

			translator.translate('[[global:home]]').then(function (translated) {
				assert.strictEqual(translated, 'Übersicht');
				done();
			});
		});

		it('should handle language keys in regular text with another language specified', function (done) {
            var translator = new Translator('de');

			translator.translate('[[global:home]] test').then(function (translated) {
				assert.strictEqual(translated, 'Übersicht test');
				done();
			});
		});

		it('should handle language keys with parameters', function (done) {
            var translator = new Translator('en_GB');

			translator.translate('[[global:pagination.out_of, 1, 5]]').then(function (translated) {
				assert.strictEqual(translated, '1 out of 5');
				done();
			});
		});

		it('should handle language keys inside language keys', function (done) {
            var translator = new Translator('en_GB');

			translator.translate('[[notifications:outgoing_link_message, [[global:guest]]]]').then(function (translated) {
				assert.strictEqual(translated, 'You are now leaving Guest');
				done();
			});
		});

		it('should handle language keys inside language keys with multiple parameters', function (done) {
            var translator = new Translator('en_GB');

			translator.translate('[[notifications:user_posted_to, [[global:guest]], My Topic]]').then(function (translated) {
				assert.strictEqual(translated, '<strong>Guest</strong> has posted a reply to: <strong>My Topic</strong>');
				done();
			});
		});

		it('should handle language keys inside language keys with all parameters as language keys', function (done) {
            var translator = new Translator('en_GB');

			translator.translate('[[notifications:user_posted_to, [[global:guest]], [[global:guest]]]]').then(function (translated) {
				assert.strictEqual(translated, '<strong>Guest</strong> has posted a reply to: <strong>Guest</strong>');
				done();
			});
		});

		it('should properly handle parameters that contain square brackets', function (done) {
            var translator = new Translator('en_GB');

			translator.translate('[[global:pagination.out_of, [guest], [[global:home]]]]').then(function (translated) {
				assert.strictEqual(translated, '[guest] out of Home');
				done();
			});
		});

		it('should properly handle parameters that contain parentheses', function (done) {
            var translator = new Translator('en_GB');

			translator.translate('[[global:pagination.out_of, (foobar), [[global:home]]]]').then(function (translated) {
				assert.strictEqual(translated, '(foobar) out of Home');
				done();
			});
		});

		it('should not translate language key parameters with HTML in them', function (done) {
            var translator = new Translator('en_GB');

			var key = '[[global:403.login, <strong>test</strong>]]';
			translator.translate(key).then(function (translated) {
				assert.strictEqual(translated, 'Perhaps you should <a href=\'&lt;strong&gt;test&lt;/strong&gt;/login\'>try logging in</a>?');
				done();
			});
		});

		it('should properly escape % and ,', function (done) {
			var translator = new Translator('en_GB');

			var title = 'Test 1, 2, 3 % salmon';
			title = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
			var key = "[[topic:composer.replying_to, " + title + "]]";
			translator.translate(key).then(function (translated) {
				assert.strictEqual(translated, 'Replying to Test 1, 2, 3 % salmon');
				done();
			});
		});

		it('should throw if not passed a language', function (done) {
			assert.throws(function () {
				new Translator();
			}, /language string/);
			done();
		});

		it('should not translate [[derp] some text', function (done) {
			var translator = new Translator('en_GB');
			translator.translate('[[derp] some text').then(function (translated) {
				assert.strictEqual('[[derp] some text', translated);
				done();
			});
		});

		it('should not translate [[derp:xyz] some text', function (done) {
			var translator = new Translator('en_GB');
			translator.translate('[[derp:xyz] some text').then(function (translated) {
				assert.strictEqual('[[derp:xyz] some text', translated);
				done();
			});
		});

		it('should translate [[pages:users/latest]] properly', function(done) {
			var translator = new Translator('en_GB');
			translator.translate('[[pages:users/latest]]').then(function(translated) {
				assert.strictEqual('[[pages:users/latest]]', 'Latest Users');
				done();
			});
		});
	});
});

describe('Translator.create()', function (){
	it('should return an instance of Translator', function (done) {
		var translator = Translator.create('en_GB');

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

		assert.strictEqual(translator.lang, 'en_GB');
		done();
	});
});
