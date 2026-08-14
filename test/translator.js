'use strict';

// For tests relating to Transifex configuration, check i18n.js

const { before, it, describe } = require('node:test');

const assert = require('assert');
const benchpress = require('benchpressjs');

const shim = require('../src/translator');

const { Translator } = shim;
const db = require('./mocks/databasemock');
const helpers = require('../src/helpers');
const languages = require('../src/languages');

describe('Translator shim', () => {

	describe('tx helper', () => {

		const context = { };

		before(async () => {
			context._i18n = await languages.getFull('en-GB');
			context._i18n.topic['argument-test'] = 'Test arguments like %1 and %2, in them: %3';
			context._i18n.topic['no-arguments'] = 'no arguments here';
			context._i18n.topic['nested-key'] = {
				'nested-1': 'Nested key %1',
			};
		});

		shim.addTranslation('en-GB', 'topic', {
			'argument-test': 'Test arguments like %1 and %2, in them: %3',
		});

		it('should return translated string with interpolation', (t, done) => {
			const str = helpers.tx.call(context, 'topic:moved-from', 'general discussion');
			assert.strictEqual(str, 'Moved from general discussion');
			done();
		});

		it('should fallback to passed in string when translation is missing', (t, done) => {
			const str = helpers.tx.call(context, 'topic:missing-key', 'general discussion');
			assert.strictEqual(str, 'topic:missing-key');
			done();
		});

		it('should work with [[topic:moved-from]] syntax', (t, done) => {
			const str = helpers.tx.call(context, '[[topic:moved-from]]', 'general discussion');
			assert.strictEqual(str, 'Moved from general discussion');
			done();
		});

		it('should work with % and , in arguments syntax', async () => {
			const compiled = shim.compile('topic:argument-test', 'ar%1g1', 'arg,2', 'arg3');
			const shimStr = await shim.translate(compiled);
			const str = helpers.tx.call(context, '[[topic:argument-test, ar&#37;1g1, arg&#44;2, arg3]]');

			assert.strictEqual(str, 'Test arguments like ar&#37;1g1 and arg,2, in them: arg3');
			assert.strictEqual(str, shimStr);
		});

		it('should html escape the token if it is not found in _i18n', (t, done) => {
			const str = helpers.tx.call(context, '<script>alert("xss")</script>');
			assert.strictEqual(str, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
			done();
		});

		it('should html escape arguments', (t, done) => {
			const str = helpers.tx.call(context, 'topic:moved-from', '<script>alert("xss")</script>');
			assert.strictEqual(str, 'Moved from &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
			done();
		});

		it('should escape html, if everything is passed as first string and its not a valid token', (t, done) => {
			const str = helpers.tx.call(context, '[[<script>alert("xss")</script>, <script>alert("xss")</script>]]');
			assert.strictEqual(str, '[[&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;, &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;]]');
			done();
		});

		it('should validate href arguments', (t, done) => {
			const str = helpers.tx.call(context, 'topic:merged-message', 'javascript:alert(origin)', 'baz');
			assert.strictEqual(str, 'This topic has been merged into <a href="">baz</a>');
			done();
		});

		it('should properly translate if arguments have % or , in them', (t, done) => {
			const str = helpers.tx.call(context, 'topic:argument-test', '%2 awesome, really', 'wow 2%', ',works');
			assert.strictEqual(str, 'Test arguments like &#37;2 awesome, really and wow 2%, in them: ,works');
			done();
		});

		it('should translate arguments if they are tokens themselves', (t, done) => {
			const str = helpers.tx.call(context, 'topic:moved-from', '[[topic:no-arguments]]');
			assert.strictEqual(str, 'Moved from no arguments here');
			done();
		});

		it('should translate nested keys with arguments', (t, done) => {
			const translated = helpers.tx.call(context, '[[notifications:new-message-in, [[modules:chat.room-id, 8]]]]');
			assert.strictEqual(translated, 'New message in <strong>Room 8</strong>');
			done();
		});

		it('should work with nested translation context', (t, done) => {
			const translated = helpers.tx.call(context, '[[topic:nested-key.nested-1, foo]]');
			assert.strictEqual(translated, 'Nested key foo');
			done();
		});

		it('should html escape arguments but keep it if it\'s coming from tx file', (t, done) => {
			const str = helpers.tx.call(context, 'topic:merged-message', '/forum/<script>alert("xss")</script>', 'topic name');
			assert.strictEqual(str, 'This topic has been merged into <a href="/forum/&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;">topic name</a>');
			done();
		});

		it('should return passed in string if it\'s not found in _i18n and not replace arguments', (t, done) => {
			const str = helpers.tx.call({}, 'this is a regular % 1 string', 'general discussion');

			assert.strictEqual(str, 'this is a regular % 1 string');
			done();
		});

		it('should work with benchpress.compileRender to parse and translate a custom string', async () => {
			const compiled = await benchpress.compileRender('some {foo} with translation {tx("topic:moved-from", "general discussion")}', {
				foo: 'bar',
				_i18n: {
					topic: {
						'moved-from': 'Moved from %1',
					},
				},
			});
			assert.strictEqual(compiled, 'some bar with translation Moved from general discussion');
		});
	});

	describe('isTranslationKey/hasTranslationKey', () => {
		it('should detect valid translation keys', (t, done) => {
			assert.strictEqual(shim.isTranslationKey('[[global:home]]'), true);
			assert.strictEqual(shim.isTranslationKey('[[global:home, arg1, arg2]]'), true);
			assert.strictEqual(shim.isTranslationKey('[[global:home, [[nested:key]]]]'), true);
			assert.strictEqual(shim.isTranslationKey('[[global:home, [[nested:key]], arg2]]'), true);
			assert.strictEqual(shim.isTranslationKey('[[global:home, [[nested:key]], [[nested:key2]]]]'), true);
			done();
		});

		it('should detect invalid translation keys', (t, done) => {
			assert.strictEqual(shim.isTranslationKey('[[global:home'), false);
			assert.strictEqual(shim.isTranslationKey('global:home]]'), false);
			assert.strictEqual(shim.isTranslationKey('[[global:home, [[nested:key]]'), false);
			assert.strictEqual(shim.isTranslationKey('[[global:home, [[nested:key]], arg2'), false);
			assert.strictEqual(shim.isTranslationKey('[[global:home, [[nested:key]], [[nested:key2]]'), false);
			done();
		});

		it('should return true if text has translation keys', (t, done) => {
			assert.strictEqual(shim.hasTranslationKey('[[global:home]]'), true);
			assert.strictEqual(shim.hasTranslationKey('[[global:home, arg1, arg2]]'), true);
			assert.strictEqual(shim.hasTranslationKey('testing [[global:home, arg1, arg2]] text'), true);
			assert.strictEqual(shim.hasTranslationKey(']] some text here [[namespace1:key1, arg1, arg2]] other text [[invalid]] test [[namespace2:key2]] [[invalid'), true);
			done();
		});

		it('should return false if text does not have translation keys', (t, done) => {
			assert.strictEqual(shim.hasTranslationKey('global:home'), false);
			assert.strictEqual(shim.hasTranslationKey('[[global:home, arg1, arg2'), false);
			assert.strictEqual(shim.hasTranslationKey('testing global:home, arg1, arg2]] text'), false);
			assert.strictEqual(shim.hasTranslationKey(']] some text here namespace1:key1, arg1, arg2]] other text invalid]] test [[invalid'), false);
			done();
		});
	});

	describe('.normalizeToken', () => {
		it('should normalize a token into its key and arguments', (t, done) => {
			assert.deepStrictEqual(
				shim.normalizeToken('[[notifications:new-message-in, [[modules:chat.room-id, 8]]]]'),
				['notifications:new-message-in', ['[[modules:chat.room-id, 8]]']]
			);

			assert.deepStrictEqual(
				shim.normalizeToken('[[notifications:new-message-in, arg1, arg]]'),
				['notifications:new-message-in', ['arg1', 'arg']]
			);

			assert.deepStrictEqual(
				shim.normalizeToken('[[notifications:new-message-in, [[modules:chat.room-id, 8]], arg]]'),
				['notifications:new-message-in', ['[[modules:chat.room-id, 8]]', 'arg']]
			);
			done();
		});
	});

	describe('.translate()', () => {
		it('should translate correctly', async () => {
			const translated = await shim.translate('[[global:pagination.out-of, (foobar), [[global:home]]]]');
			assert.strictEqual(translated, '(foobar) out of Home');
		});

		it('should accept a language parameter and adjust accordingly', async () => {
			const translated = await shim.translate('[[global:home]]', 'de');
			assert.strictEqual(translated, 'Übersicht');
		});

		it('should translate empty string properly', async () => {
			const translated = await shim.translate('', 'en-GB');
			assert.strictEqual(translated, '');
		});

		it('should translate empty string properly', async () => {
			const translated = await shim.translate('', 'en-GB');
			assert.strictEqual(translated, '');
		});

		it('should not allow path traversal', async () => {
			const t = await shim.translate('[[../../../../config:secret]]');
			assert.strictEqual(t, '[[../../../../config:secret]]');
			await assert.rejects(
				languages.get('en-GB', '../../../../config'),
				{ message: '[[error:invalid-path]]' }
			);
		});
	});

	describe('translateKey / translateKeys', () => {
		shim.addTranslation('en-GB', 'topic', {
			'tx-token': 'TX TOKEN',
		});

		it('should translate a single key with no arguments', async () => {
			const translated = await shim.translateKey('global:search', [], 'en-GB');
			assert.strictEqual(translated, 'Search');
		});

		it('should translate a single key with arguments', async () => {
			const translated = await shim.translateKey('topic:moved-from', ['general discussion']);
			assert.strictEqual(translated, 'Moved from general discussion');
		});

		it('should translate a single key with brackets arguments', async () => {
			const translated = await shim.translateKey('[[topic:moved-from]]', ['general discussion']);
			assert.strictEqual(translated, 'Moved from general discussion');
		});

		it('should translate nested keys', async () => {
			const translated = await shim.translateKey('[[topic:moved-from, [[topic:merged-message]]]]');
			assert.strictEqual(translated, 'Moved from This topic has been merged into <a href="">&#37;2</a>');
		});

		it('should translate nested keys with arguments', async () => {
			const translated = await shim.translateKey('[[notifications:new-message-in, [[modules:chat.room-id, 8]]]]');
			assert.strictEqual(translated, 'New message in <strong>Room 8</strong>');
		});

		it('should translate arguments if they are tokens themselves', async () => {
			const str = await shim.translateKey('topic:moved-from', ['[[topic:tx-token]]']);
			assert.strictEqual(str, 'Moved from TX TOKEN');
		});

		it('should return string untouched if it\'s not a tx string', async () => {
			assert.strictEqual(
				await shim.translateKey('nodebb forum', [], 'en-GB'),
				'nodebb forum',
			);

			assert.strictEqual(
				await shim.translateKey('this is a [[foo:baz]] regular string %1 test', [], 'en-GB'),
				'this is a [[foo:baz]] regular string %1 test',
			);

			assert.strictEqual(
				await shim.translateKey('[[this is a [[foo:baz, "foo"]] regular string %1 test]]', [], 'en-GB'),
				'[[this is a [[foo:baz, &quot;foo&quot;]] regular string %1 test]]'
			);
		});

		it('should translate each key in array', async () => {
			const translated = await shim.translateKeys(['[[global:home]]', '[[global:search]]'], 'en-GB');
			assert.deepStrictEqual(translated, ['Home', 'Search']);
		});

		it('should translate each key in array using a callback', (t, done) => {
			shim.translateKeys(['[[global:save]]', '[[global:close]]'], 'en-GB', (translated) => {
				assert.deepStrictEqual(translated, ['Save', 'Close']);
				done();
			});
		});

		it('should translate all the elements in array in new format', async () => {
			const translated = await shim.translateKeys([
				['topic:share-mail-subject', ['nodebb']],
				['topic:share-mail-body', ['http://example.com/post/123'], 'de'],
			]);
			assert.deepStrictEqual(translated, [
				'Check out this post on "nodebb"',
				'Ich dachte, dieser Beitrag könnte dich interessieren: http://example.com/post/123',
			]);
		});

		it('should translate keys with args in old format', async () => {
			const translated = await shim.translateKeys([
				'[[topic:share-mail-subject, nodebb]]',
				'[[topic:share-mail-body, http://example.com/post/123]]',
			], 'en-GB');
			assert.deepStrictEqual(translated, [
				'Check out this post on "nodebb"',
				'I thought you might be interested in this post: http://example.com/post/123',
			]);
		});
	});

	it('should load translations for language', (t, done) => {
		shim.load('en-GB', 'global', (translations) => {
			assert(translations);
			assert(translations['header.profile']);
			done();
		});
	});

	it('should get translations for language', (t, done) => {
		shim.getTranslations('en-GB', 'global', (translations) => {
			assert(translations);
			assert(translations['header.profile']);
			done();
		});
	});
});

describe('new Translator(language)', () => {
	it('should throw if not passed a language', (t, done) => {
		assert.throws(() => {
			new Translator();
		}, /language string/);
		done();
	});

	describe('.translate()', () => {
		it('should handle basic translations', (t, done) => {
			const translator = Translator.create('en-GB');

			translator.translate('[[global:home]]').then((translated) => {
				assert.strictEqual(translated, 'Home');
				done();
			});
		});

		it('should handle language keys in regular text', (t, done) => {
			const translator = Translator.create('en-GB');

			translator.translate('Let\'s go [[global:home]]').then((translated) => {
				assert.strictEqual(translated, 'Let\'s go Home');
				done();
			});
		});

		it('should handle language keys in regular text with another language specified', (t, done) => {
			const translator = Translator.create('de');

			translator.translate('[[global:home]] test').then((translated) => {
				assert.strictEqual(translated, 'Übersicht test');
				done();
			});
		});

		it('should handle language keys with parameters', (t, done) => {
			const translator = Translator.create('en-GB');

			translator.translate('[[global:pagination.out-of, 1, 5]]').then((translated) => {
				assert.strictEqual(translated, '1 out of 5');
				done();
			});
		});

		it('should handle language keys inside language keys', (t, done) => {
			const translator = Translator.create('en-GB');

			translator.translate('[[notifications:outgoing-link-message, [[global:guest]]]]').then((translated) => {
				assert.strictEqual(translated, 'You are now leaving Guest');
				done();
			});
		});

		it('should handle language keys inside language keys with multiple parameters', (t, done) => {
			const translator = Translator.create('en-GB');

			translator.translate('[[notifications:user-posted-to, [[global:guest]], My Topic]]').then((translated) => {
				assert.strictEqual(translated, '<strong>Guest</strong> posted a reply in <strong>My Topic</strong>');
				done();
			});
		});

		it('should handle language keys inside language keys with all parameters as language keys', (t, done) => {
			const translator = Translator.create('en-GB');

			translator.translate('[[notifications:user-posted-to, [[global:guest]], [[global:guest]]]]').then((translated) => {
				assert.strictEqual(translated, '<strong>Guest</strong> posted a reply in <strong>Guest</strong>');
				done();
			});
		});

		it('should properly handle parameters that contain square brackets', (t, done) => {
			const translator = Translator.create('en-GB');

			translator.translate('[[global:pagination.out-of, [guest], [[global:home]]]]').then((translated) => {
				assert.strictEqual(translated, '[guest] out of Home');
				done();
			});
		});

		it('should properly handle parameters that contain parentheses', (t, done) => {
			const translator = Translator.create('en-GB');

			translator.translate('[[global:pagination.out-of, (foobar), [[global:home]]]]').then((translated) => {
				assert.strictEqual(translated, '(foobar) out of Home');
				done();
			});
		});

		it('should escape language key parameters with HTML in them', (t, done) => {
			const translator = Translator.create('en-GB');

			const key = '[[topic:share-mail-body, <strong>test</strong>]]';
			translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'I thought you might be interested in this post: &lt;strong&gt;test&lt;/strong&gt;');
				done();
			});
		});

		it('should not unescape html in parameters', (t, done) => {
			const translator = Translator.create('en-GB');

			const key = '[[pages:tag, some&amp;tag]]';
			translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'Topics tagged under &quot;some&amp;tag&quot;');
				done();
			});
		});

		it('should translate escaped translation arguments properly', (t, done) => {
			// https://github.com/NodeBB/NodeBB/issues/9206
			const translator = Translator.create('en-GB');

			const key = '[[notifications:upvoted-your-post-in, test1, error: Error: &lsqb;&lsqb;error:group-name-too-long&rsqb;&rsqb; on NodeBB Upgrade]]';
			translator.translate(key).then((translated) => {
				assert.strictEqual(translated, '<strong>test1</strong> upvoted your post in <strong>error: Error: &lsqb;&lsqb;error:group-name-too-long&rsqb;&rsqb; on NodeBB Upgrade</strong>');
				done();
			});
		});

		it('should strip href argument if it contains a javascript: URL', async function () {
			const translator = Translator.create('en-GB');

			assert.strictEqual(
				await translator.translate('[[topic:merged-message,    javascript:alert(origin), foo]]'),
				'This topic has been merged into <a href="">foo</a>'
			);

			assert.strictEqual(
				await translator.translate('[[topic:merged-message, %20%20%20javascript:alert(origin), foo]]'),
				'This topic has been merged into <a href="">foo</a>'
			);

			assert.strictEqual(
				await translator.translate('[[global:403.login, javascript:alert(origin)]]'),
				'Perhaps you should <a class="alert-link" href="">try logging in</a>?'
			);
		});

		it('should not strip javascript from arguments if it\'s not a href attribute', async function () {
			const translator = Translator.create('en-GB');

			assert.strictEqual(
				await translator.translate('[[topic:share-mail-body,    javascript:alert(origin)]]'),
				'I thought you might be interested in this post: javascript:alert(origin)'
			);
		});

		it('should let valid urls through and empty href for invalid urls', async function () {
			shim.addTranslation('en-GB', 'topic', {
				'href-test-1': 'This topic has been merged into <a href="%1">%2</a> and <a href="%1">%3</a>',
				'href-test-2': 'This topic has been merged into <a href="%1/topic/%2">%3</a>',
				'href-test-3': '<a href="%1">%2</a> and <a href="%3">%4</a>',
				'href-test-4': '<a href="%1%2">%3</a>',
				'href-test-5': '<a href=\'%1\'>%2</a>',
			});

			assert.strictEqual(
				await shim.translate('[[topic:merged-message, https://example.com/topic/1, foo]]'),
				'This topic has been merged into <a href="https://example.com/topic/1">foo</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:merged-message, http://example.com/topic/1, foo]]'),
				'This topic has been merged into <a href="http://example.com/topic/1">foo</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:merged-message, /topic/123, foo]]'),
				'This topic has been merged into <a href="/topic/123">foo</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:merged-message,    javascript is a nice language, foo]]'),
				'This topic has been merged into <a href="">foo</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:href-test-1, /topic/123, foo, bar]]'),
				'This topic has been merged into <a href="/topic/123">foo</a> and <a href="/topic/123">bar</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:href-test-1, javascript:alert(origin), foo, bar]]'),
				'This topic has been merged into <a href="">foo</a> and <a href="">bar</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:href-test-2, javascript:alert(origin), foo, bar]]'),
				'This topic has been merged into <a href="">bar</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:href-test-3, javascript:alert(origin), foo, data:123, baz]]'),
				'<a href="">foo</a> and <a href="">baz</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:href-test-4, javascript:alert(origin), javascript:alert(origin), foo]]'),
				'<a href="">foo</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:href-test-5, javascript:alert(origin), foo]]'),
				'<a href="">foo</a>'
			);

			assert.strictEqual(
				await shim.translate('[[topic:merged-message, "javascript:alert(origin), foo, bar]]'),
				'This topic has been merged into <a href="">foo</a>'
			);
		});

		it('should properly escape and ignore % and \\, in arguments', (t, done) => {
			const translator = Translator.create('en-GB');

			const title = 'Test 1\\, 2\\, 3 %2 salmon';
			const key = `[[topic:composer.replying-to, ${title}]]`;
			translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'Replying to Test 1&#44; 2&#44; 3 &#37;2 salmon');
				done();
			});
		});

		it('should not escape regular %', (t, done) => {
			const translator = Translator.create('en-GB');

			const title = '3 % salmon';
			const key = `[[topic:composer.replying-to, ${title}]]`;
			translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'Replying to 3 % salmon');
				done();
			});
		});

		it('should not translate [[derp] some text', (t, done) => {
			const translator = Translator.create('en-GB');
			translator.translate('[[derp] some text').then((translated) => {
				assert.strictEqual('[[derp] some text', translated);
				done();
			});
		});

		it('should not translate [[derp]] some text', (t, done) => {
			const translator = Translator.create('en-GB');
			translator.translate('[[derp]] some text').then((translated) => {
				assert.strictEqual('[[derp]] some text', translated);
				done();
			});
		});

		it('should not translate [[derp:xyz] some text', (t, done) => {
			const translator = Translator.create('en-GB');
			translator.translate('[[derp:xyz] some text').then((translated) => {
				assert.strictEqual('[[derp:xyz] some text', translated);
				done();
			});
		});

		it('should not translate [[topic:merged-message some text', (t, done) => {
			const translator = Translator.create('en-GB');
			translator.translate('[[topic:merged-message some text').then((translated) => {
				assert.strictEqual('[[topic:merged-message some text', translated);
				done();
			});
		});

		it('should translate keys with slashes properly', (t, done) => {
			const translator = Translator.create('en-GB');
			translator.translate('[[pages:users/latest]]').then((translated) => {
				assert.strictEqual(translated, 'Latest Users');
				done();
			});
		});

		it('should use key for unknown keys without arguments', (t, done) => {
			const translator = Translator.create('en-GB');
			translator.translate('[[unknown:key.without.args]]').then((translated) => {
				assert.strictEqual(translated, '[[unknown:key.without.args]]');
				done();
			});
		});

		it('should use backup for unknown keys with arguments', (t, done) => {
			const translator = Translator.create('en-GB');
			translator.translate('[[unknown:key.with.args, arguments are here, derpity, derp]]').then((translated) => {
				assert.strictEqual(translated, '[[unknown:key.with.args, arguments are here, derpity, derp]]');
				done();
			});
		});

		it('should ignore unclosed tokens', async () => {
			const translator = Translator.create('en-GB');
			assert.strictEqual(
				await translator.translate('here is some stuff and other things [[abc:xyz, other random stuff should be fine here [[global:home]] and more things [[pages:users/latest]]'),
				'here is some stuff and other things [[abc:xyz, other random stuff should be fine here Home and more things Latest Users'
			);

			assert.strictEqual(
				await translator.translate('mine]] [[topic:merged-message, foo, best'),
				'mine]] [[topic:merged-message, foo, best'
			);
		});
	});
});

describe('Translator.create()', () => {
	it('should return an instance of Translator', (t, done) => {
		const translator = Translator.create('en-GB');

		assert(translator instanceof Translator);
		done();
	});
	it('should return the same object for the same language', (t, done) => {
		const one = Translator.create('de');
		const two = Translator.create('de');

		assert.strictEqual(one, two);
		done();
	});
	it('should default to defaultLang', (t, done) => {
		const translator = Translator.create();

		assert.strictEqual(translator.lang, 'en-GB');
		done();
	});
});

describe('Translator modules', () => {
	it('should work before registered', (t, done) => {
		const translator = Translator.create();

		Translator.registerModule('test-custom-integer-format', lang => function (key, args) {
			const num = parseInt(args[0], 10) || 0;
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
		});

		translator.translate('[[test-custom-integer-format:octal, 24]]').then((translation) => {
			assert.strictEqual(translation, '30');
			done();
		});
	});

	it('should work after registered', (t, done) => {
		const translator = Translator.create('de');

		translator.translate('[[test-custom-integer-format:octal, 23]]').then((translation) => {
			assert.strictEqual(translation, '27');
			done();
		});
	});

	it('registerModule be passed the language', (t, done) => {
		Translator.registerModule('something', (lang) => {
			assert.ok(lang);
		});

		const translator = Translator.create('fr_FR');
		done();
	});
});

describe('Translator static methods', () => {
	describe('.removePatterns', () => {
		it('should remove translator patterns from text', (t, done) => {
			assert.strictEqual(
				Translator.removePatterns('Lorem ipsum dolor [[sit:amet]], consectetur adipiscing elit. [[sed:vitae, [[semper:dolor]]]] lorem'),
				'Lorem ipsum dolor , consectetur adipiscing elit.  lorem'
			);
			done();
		});
	});
	describe('.escape/.unescape', () => {
		it('should escape translation patterns within text', (t, done) => {
			assert.strictEqual(
				Translator.escape('some nice text [[global:home]] here'),
				'some nice text &lsqb;&lsqb;global:home&rsqb;&rsqb; here'
			);
			done();
		});

		it('should escape all translation patterns within text', (t, done) => {
			assert.strictEqual(
				Translator.escape('some nice text [[global:home]] here and [[global:search]] there'),
				'some nice text &lsqb;&lsqb;global:home&rsqb;&rsqb; here and &lsqb;&lsqb;global:search&rsqb;&rsqb; there'
			);
			done();
		});

		it('should unescape escaped translation patterns within text', (t, done) => {
			assert.strictEqual(
				Translator.unescape('some nice text &lsqb;&lsqb;global:home&rsqb;&rsqb; here'),
				'some nice text [[global:home]] here'
			);
			done();
		});

		it('should escape translation pattern that have arguments', () => {
			assert.strictEqual(
				Translator.escape('[[topic:merged-message, https://example.com, foo]]'),
				'&lsqb;&lsqb;topic:merged-message, https://example.com, foo&rsqb;&rsqb;'
			);

			assert.strictEqual(
				Translator.escape('[[topic:merged-message, [[https://example.com]], foo]]'),
				'&lsqb;&lsqb;topic:merged-message, &lsqb;&lsqb;https://example.com&rsqb;&rsqb;, foo&rsqb;&rsqb;'
			);
		});

		it('should unescape translation pattern that have arguments', () => {
			assert.strictEqual(
				Translator.unescape('&lsqb;&lsqb;topic:merged-message, https://example.com, foo&rsqb;&rsqb;'),
				'[[topic:merged-message, https://example.com, foo]]'
			);

			assert.strictEqual(
				Translator.unescape('&lsqb;&lsqb;topic:merged-message, &lsqb;&lsqb;https://example.com&rsqb;&rsqb;, foo&rsqb;&rsqb;'),
				'[[topic:merged-message, [[https://example.com]], foo]]'
			);
		});
	});

	describe('.compile', () => {
		it('should create a translator pattern from a key and list of arguments', (t, done) => {
			assert.strictEqual(
				Translator.compile('amazing:cool', 'awesome', 'great'),
				'[[amazing:cool, awesome, great]]'
			);
			done();
		});

		it('should escape `%` and `,` in arguments', (t, done) => {
			assert.strictEqual(
				Translator.compile('amazing:cool', '100% awesome!', 'one, two, and three'),
				'[[amazing:cool, 100&#37; awesome!, one&#44; two&#44; and three]]'
			);
			done();
		});

		it('should escape `]]` and `[[` in arguments if they are invalid translation tokens', (t, done) => {
			assert.strictEqual(
				Translator.compile('amazing:cool', '[[nested:valid]]', 'plainstr', 'invalid]]<img src=x onerror=alert(document.domain)>'),
				'[[amazing:cool, [[nested:valid]], plainstr, invalid&rsqb;&rsqb;<img src=x onerror=alert(document.domain)>]]'
			);

			assert.strictEqual(
				Translator.compile('amazing:cool', '[[nested:valid]]', 'plainstr', 'invalid[[<img src=x onerror=alert(document.domain)>'),
				'[[amazing:cool, [[nested:valid]], plainstr, invalid&lsqb;&lsqb;<img src=x onerror=alert(document.domain)>]]'
			);

			assert.strictEqual(
				Translator.compile('amazing:cool', '[[nested:valid]]', 'plainstr', 'invalid[[<img src=x onerror=alert(document.domain)>]]'),
				'[[amazing:cool, [[nested:valid]], plainstr, invalid&lsqb;&lsqb;<img src=x onerror=alert(document.domain)>&rsqb;&rsqb;]]'
			);

			assert.strictEqual(
				Translator.compile('amazing:cool', '[[nested:invalid]]]]', ']][[invalid:foo, <img src=x onerror=alert(document.domain)>'),
				'[[amazing:cool, &lsqb;&lsqb;nested:invalid&rsqb;&rsqb;&rsqb;&rsqb;, &rsqb;&rsqb;&lsqb;&lsqb;invalid:foo&#44; <img src=x onerror=alert(document.domain)>]]'
			);

			done();
		});
	});

	describe('add translation', () => {
		it('should add custom translations', async () => {
			shim.addTranslation('en-GB', 'my-namespace', { foo: 'a custom translation' });
			const t = await shim.translate('this is best [[my-namespace:foo]]');
			assert.strictEqual(t, 'this is best a custom translation');
		});
	});

	describe('translate nested keys', () => {
		it('should handle nested translations', async () => {
			shim.addTranslation('en-GB', 'my-namespace', {
				key: {
					key1: 'key1 translated',
					key2: {
						key3: 'key3 translated',
					},
				},
			});
			const t1 = await shim.translate('this is best [[my-namespace:key.key1]]');
			const t2 = await shim.translate('this is best [[my-namespace:key.key2.key3]]');
			assert.strictEqual(t1, 'this is best key1 translated');
			assert.strictEqual(t2, 'this is best key3 translated');
		});
		it("should try the defaults if it didn't reach a string in a nested translation", async () => {
			shim.addTranslation('en-GB', 'my-namespace', {
				default1: {
					default1: 'default1 translated',
					'': 'incorrect priority',
				},
				default2: {
					'': 'default2 translated',
				},
			});
			const d1 = await shim.translate('this is best [[my-namespace:default1]]');
			const d2 = await shim.translate('this is best [[my-namespace:default2]]');
			assert.strictEqual(d1, 'this is best default1 translated');
			assert.strictEqual(d2, 'this is best default2 translated');
		});
	});
});
