'use strict';
/*global require*/

var assert = require('assert');
var translator = require('../public/src/modules/translator.js');


describe('Translator', function(){
	describe('.translate()', function(){
		it('should handle basic translations', function(done) {
			translator.translate('[[global:home]]', function(translated) {
				assert.strictEqual(translated, 'Home');
				done();
			});
		});

		it('should handle language keys in regular text', function(done) {
			translator.translate('Let\'s go [[global:home]]', function(translated) {
				assert.strictEqual(translated, 'Let\'s go Home');
				done();
			});
		});

		it('should accept a language parameter and adjust accordingly', function(done) {
			translator.translate('[[global:home]]', 'de', function(translated) {
				assert.strictEqual(translated, 'Übersicht');
				done();
			});
		});

		it('should handle language keys in regular text with another language specified', function(done) {
			translator.translate('[[global:home]] test', 'de', function(translated) {
				assert.strictEqual(translated, 'Übersicht test');
				done();
			});
		});

		it('should handle language keys with parameters', function(done) {
			translator.translate('[[global:pagination.out_of, 1, 5]]', function(translated) {
				assert.strictEqual(translated, '1 out of 5');
				done();
			});
		});

		it('should handle language keys inside language keys', function(done) {
			translator.translate('[[notifications:outgoing_link_message, [[global:guest]]]]', function(translated) {
				assert.strictEqual(translated, 'You are now leaving Guest');
				done();
			});
		});

		it('should handle language keys inside language keys with multiple parameters', function(done) {
			translator.translate('[[notifications:user_posted_to, [[global:guest]], My Topic]]', function(translated) {
				assert.strictEqual(translated, '<strong>Guest</strong> has posted a reply to: <strong>My Topic</strong>');
				done();
			});
		});

		it('should handle language keys inside language keys with all parameters as language keys', function(done) {
			translator.translate('[[notifications:user_posted_to, [[global:guest]], [[global:guest]]]]', function(translated) {
				assert.strictEqual(translated, '<strong>Guest</strong> has posted a reply to: <strong>Guest</strong>');
				done();
			});
		});

		it('should properly handle parameters that contain square brackets', function(done) {
			translator.translate('[[global:pagination.out_of, [guest], [[global:home]]]]', function(translated) {
				assert.strictEqual(translated, '[guest] out of Home');
				done();
			});
		});

		it('should properly handle parameters that contain parentheses', function(done) {
			translator.translate('[[global:pagination.out_of, (foobar), [[global:home]]]]', function(translated) {
				assert.strictEqual(translated, '(foobar) out of Home');
				done();
			});
		});

		it('should not translate language key parameters with HTML in them', function(done) {
			var key = '[[global:403.login, <strong>test</strong>]]';
			translator.translate(key, function(translated) {
				assert.strictEqual(translated, 'Perhaps you should <a href=\'&lt;strong&gt;test&lt;/strong&gt;/login\'>try logging in</a>?');
				done();
			});
		});

		it('should properly escape % and ,', function(done) {
			var title = 'Test 1, 2, 3 % salmon';
			title = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
			var key = "[[topic:composer.replying_to, " + title + "]]";
			translator.translate(key, function(translated) {
				assert.strictEqual(translated, 'Replying to Test 1, 2, 3 % salmon');
				done();
			});
		});

	});
});
