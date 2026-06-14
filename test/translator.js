'use strict';

// For tests relating to Transifex configuration, check i18n.js

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
		});

		shim.addTranslation('en-GB', 'topic', {
			'argument-test': 'Test arguments like %1 and %2, in them: %3',
		});

		it('should return translated string with interpolation', (done) => {
			const str = helpers.tx.call(context, 'topic:moved-from', 'general discussion');
			assert.strictEqual(str, 'Moved from general discussion');
			done();
		});

		it('should fallback to passed in string when translation is missing', (done) => {
			const str = helpers.tx.call(context, 'topic:missing-key', 'general discussion');
			assert.strictEqual(str, 'topic:missing-key');
			done();
		});

		it('should work with [[topic:moved-from]] syntax', (done) => {
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

		it('should html escape the token if it is not found in _i18n', (done) => {
			const str = helpers.tx.call(context, '<script>alert("xss")</script>');
			assert.strictEqual(str, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
			done();
		});

		it('should html escape arguments', (done) => {
			const str = helpers.tx.call(context, 'topic:moved-from', '<script>alert("xss")</script>');
			assert.strictEqual(str, 'Moved from &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
			done();
		});

		it('should escape html if everything is passed as first string and its not a valid token', (done) => {
			const str = helpers.tx.call(context, '[[<script>alert("xss")</script>, <script>alert("xss")</script>]]');
			assert.strictEqual(str, '[[&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;, &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;]]');
			done();
		});

		it('should validate href arguments', (done) => {
			const str = helpers.tx.call(context, 'topic:merged-message', 'javascript:alert(origin)', 'baz');
			assert.strictEqual(str, 'This topic has been merged into <a href="">baz</a>');
			done();
		});

		it('should properly translate if arguments have % or , in them', (done) => {
			const str = helpers.tx.call(context, 'topic:argument-test', '%2 awesome, really', 'wow 2%', ',works');
			assert.strictEqual(str, 'Test arguments like &#37;2 awesome, really and wow 2%, in them: ,works');
			done();
		});

		it('should translate arguments if they are tokens themselves', (done) => {
			const str = helpers.tx.call(context, 'topic:moved-from', '[[topic:no-arguments]]');
			assert.strictEqual(str, 'Moved from no arguments here');
			done();
		});

		it('should html escape arguments but keep it if it\'s coming from tx file', (done) => {
			const str = helpers.tx.call(context, 'topic:merged-message', '/forum/<script>alert("xss")</script>', 'topic name');
			assert.strictEqual(str, 'This topic has been merged into <a href="/forum/&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;">topic name</a>');
			done();
		});

		it('should return passed in string if it\'s not found in _i18n and not replace arguments', (done) => {
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

	describe('.translate()', () => {
		it('should translate correctly', (done) => {
			shim.translate('[[global:pagination.out-of, (foobar), [[global:home]]]]', (translated) => {
				assert.strictEqual(translated, '(foobar) out of Home');
				done();
			});
		});

		it('should accept a language parameter and adjust accordingly', (done) => {
			shim.translate('[[global:home]]', 'de', (translated) => {
				assert.strictEqual(translated, 'Übersicht');
				done();
			});
		});

		it('should translate empty string properly', (done) => {
			shim.translate('', 'en-GB', (translated) => {
				assert.strictEqual(translated, '');
				done();
			});
		});

		it('should translate empty string properly', async () => {
			const translated = await shim.translate('', 'en-GB');
			assert.strictEqual(translated, '');
		});

		it('should not allow path traversal', async () => {
			const t = await shim.translate('[[../../../../config:secret]]');
			assert.strictEqual(t, 'secret');
		});
	});

	describe('translateKey / translateKeys', () => {
		shim.addTranslation('en-GB', 'topic', {
			'tx-token': 'TX TOKEN',
		});

		it('should translate a single key with no arguments', async () => {
			const translated = await shim.translateKey('global:search', [], 'en-GB');
			assert.deepStrictEqual(translated, 'Search');
		});

		it('should translate a single key with arguments', async () => {
			const translated = await shim.translateKey('topic:moved-from', ['general discussion']);
			assert.deepStrictEqual(translated, 'Moved from general discussion');
		});

		it('should translate a single key with brackets arguments', async () => {
			const translated = await shim.translateKey('[[topic:moved-from]]', ['general discussion']);
			assert.deepStrictEqual(translated, 'Moved from general discussion');
		});

		it('should translate nested keys', async () => {
			const translated = await shim.translateKey('[[topic:moved-from, [[topic:merged-message]]]]');
			assert.deepStrictEqual(translated, 'Moved from This topic has been merged into <a href="">&#37;2</a>');
		});

		it('should translate arguments if they are tokens themselves', async () => {
			const str = await shim.translateKey('topic:moved-from', ['[[topic:tx-token]]']);
			assert.strictEqual(str, 'Moved from TX TOKEN');
		});

		it('should return string untouched if it\'s not a tx string', async () => {
			assert.deepStrictEqual(
				await shim.translateKey('nodebb forum', [], 'en-GB'),
				'nodebb forum',
			);

			assert.deepStrictEqual(
				await shim.translateKey('this is a [[foo:baz]] regular string %1 test', [], 'en-GB'),
				'this is a [[foo:baz]] regular string %1 test',
			);

			assert.deepStrictEqual(
				await shim.translateKey('[[this is a [[foo:baz, "foo"]], regular string %1 test]]', [], 'en-GB'),
				'[[this is a [[foo:baz, "foo"]], regular string %1 test]]'
			);
		});

		it('should translate each key in array', async () => {
			const translated = await shim.translateKeys(['[[global:home]]', '[[global:search]]'], 'en-GB');
			assert.deepStrictEqual(translated, ['Home', 'Search']);
		});

		it('should translate each key in array using a callback', (done) => {
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

	it('should load translations for language', (done) => {
		shim.load('en-GB', 'global', (translations) => {
			assert(translations);
			assert(translations['header.profile']);
			done();
		});
	});

	it('should get translations for language', (done) => {
		shim.getTranslations('en-GB', 'global', (translations) => {
			assert(translations);
			assert(translations['header.profile']);
			done();
		});
	});
});

describe('new Translator(language)', () => {
	it('should throw if not passed a language', (done) => {
		assert.throws(() => {
			new Translator();
		}, /language string/);
		done();
	});

	describe('.translate()', () => {
		it('should handle basic translations', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[global:home]]').then((translated) => {
				assert.strictEqual(translated, 'Home');
			});
		});

		it('should handle language keys in regular text', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('Let\'s go [[global:home]]').then((translated) => {
				assert.strictEqual(translated, 'Let\'s go Home');
			});
		});

		it('should handle language keys in regular text with another language specified', () => {
			const translator = Translator.create('de');

			return translator.translate('[[global:home]] test').then((translated) => {
				assert.strictEqual(translated, 'Übersicht test');
			});
		});

		it('should handle language keys with parameters', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[global:pagination.out-of, 1, 5]]').then((translated) => {
				assert.strictEqual(translated, '1 out of 5');
			});
		});

		it('should handle language keys inside language keys', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[notifications:outgoing-link-message, [[global:guest]]]]').then((translated) => {
				assert.strictEqual(translated, 'You are now leaving Guest');
			});
		});

		it('should handle language keys inside language keys with multiple parameters', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[notifications:user-posted-to, [[global:guest]], My Topic]]').then((translated) => {
				assert.strictEqual(translated, '<strong>Guest</strong> posted a reply in <strong>My Topic</strong>');
			});
		});

		it('should handle language keys inside language keys with all parameters as language keys', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[notifications:user-posted-to, [[global:guest]], [[global:guest]]]]').then((translated) => {
				assert.strictEqual(translated, '<strong>Guest</strong> posted a reply in <strong>Guest</strong>');
			});
		});

		it('should properly handle parameters that contain square brackets', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[global:pagination.out-of, [guest], [[global:home]]]]').then((translated) => {
				assert.strictEqual(translated, '[guest] out of Home');
			});
		});

		it('should properly handle parameters that contain parentheses', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[global:pagination.out-of, (foobar), [[global:home]]]]').then((translated) => {
				assert.strictEqual(translated, '(foobar) out of Home');
			});
		});

		it('should escape language key parameters with HTML in them', () => {
			const translator = Translator.create('en-GB');

			const key = '[[topic:share-mail-body, <strong>test</strong>]]';
			return translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'I thought you might be interested in this post: &lt;strong&gt;test&lt;/strong&gt;');
			});
		});

		it('should not unescape html in parameters', () => {
			const translator = Translator.create('en-GB');

			const key = '[[pages:tag, some&amp;tag]]';
			return translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'Topics tagged under &quot;some&amp;tag&quot;');
			});
		});

		it('should translate escaped translation arguments properly', () => {
			// https://github.com/NodeBB/NodeBB/issues/9206
			const translator = Translator.create('en-GB');

			const key = '[[notifications:upvoted-your-post-in, test1, error: Error: &lsqb;&lsqb;error:group-name-too-long&rsqb;&rsqb; on NodeBB Upgrade]]';
			return translator.translate(key).then((translated) => {
				assert.strictEqual(translated, '<strong>test1</strong> upvoted your post in <strong>error: Error: &lsqb;&lsqb;error:group-name-too-long&rsqb;&rsqb; on NodeBB Upgrade</strong>');
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
				await shim.translate('[[topic:merged-message, "javascript:alert(origin), foo, bar]]'),
				'This topic has been merged into <a href="">foo</a>'
			);
		});

		it('should properly escape and ignore % and \\, in arguments', () => {
			const translator = Translator.create('en-GB');

			const title = 'Test 1\\, 2\\, 3 %2 salmon';
			const key = `[[topic:composer.replying-to, ${title}]]`;
			return translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'Replying to Test 1&#44; 2&#44; 3 &#37;2 salmon');
			});
		});

		it('should not escape regular %', () => {
			const translator = Translator.create('en-GB');

			const title = '3 % salmon';
			const key = `[[topic:composer.replying-to, ${title}]]`;
			return translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'Replying to 3 % salmon');
			});
		});

		it('should not translate [[derp] some text', () => {
			const translator = Translator.create('en-GB');
			return translator.translate('[[derp] some text').then((translated) => {
				assert.strictEqual('[[derp] some text', translated);
			});
		});

		it('should not translate [[derp]] some text', () => {
			const translator = Translator.create('en-GB');
			return translator.translate('[[derp]] some text').then((translated) => {
				assert.strictEqual('[[derp]] some text', translated);
			});
		});

		it('should not translate [[derp:xyz] some text', () => {
			const translator = Translator.create('en-GB');
			return translator.translate('[[derp:xyz] some text').then((translated) => {
				assert.strictEqual('[[derp:xyz] some text', translated);
			});
		});

		it('should not translate [[topic:merged-message some text', () => {
			const translator = Translator.create('en-GB');
			return translator.translate('[[topic:merged-message some text').then((translated) => {
				assert.strictEqual('[[topic:merged-message some text', translated);
			});
		});

		it('should translate keys with slashes properly', () => {
			const translator = Translator.create('en-GB');
			return translator.translate('[[pages:users/latest]]').then((translated) => {
				assert.strictEqual(translated, 'Latest Users');
			});
		});

		it('should use key for unknown keys without arguments', () => {
			const translator = Translator.create('en-GB');
			return translator.translate('[[unknown:key.without.args]]').then((translated) => {
				assert.strictEqual(translated, 'key.without.args');
			});
		});

		it('should use backup for unknown keys with arguments', () => {
			const translator = Translator.create('en-GB');
			return translator.translate('[[unknown:key.with.args, arguments are here, derpity, derp]]').then((translated) => {
				assert.strictEqual(translated, 'unknown:key.with.args, arguments are here, derpity, derp');
			});
		});

		it('should ignore unclosed tokens', () => {
			const translator = Translator.create('en-GB');
			return translator.translate('here is some stuff and other things [[abc:xyz, other random stuff should be fine here [[global:home]] and more things [[pages:users/latest]]').then((translated) => {
				assert.strictEqual(translated, 'here is some stuff and other things abc:xyz, other random stuff should be fine here Home and more things Latest Users');
			});
		});
	});
});

describe('Translator.create()', () => {
	it('should return an instance of Translator', (done) => {
		const translator = Translator.create('en-GB');

		assert(translator instanceof Translator);
		done();
	});
	it('should return the same object for the same language', (done) => {
		const one = Translator.create('de');
		const two = Translator.create('de');

		assert.strictEqual(one, two);
		done();
	});
	it('should default to defaultLang', (done) => {
		const translator = Translator.create();

		assert.strictEqual(translator.lang, 'en-GB');
		done();
	});
});

describe('Translator modules', () => {
	it('should work before registered', () => {
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

		return translator.translate('[[test-custom-integer-format:octal, 24]]').then((translation) => {
			assert.strictEqual(translation, '30');
		});
	});

	it('should work after registered', () => {
		const translator = Translator.create('de');

		return translator.translate('[[test-custom-integer-format:octal, 23]]').then((translation) => {
			assert.strictEqual(translation, '27');
		});
	});

	it('registerModule be passed the language', (done) => {
		Translator.registerModule('something', (lang) => {
			assert.ok(lang);
		});

		const translator = Translator.create('fr_FR');
		done();
	});
});

describe('Translator static methods', () => {
	describe('.removePatterns', () => {
		it('should remove translator patterns from text', (done) => {
			assert.strictEqual(
				Translator.removePatterns('Lorem ipsum dolor [[sit:amet]], consectetur adipiscing elit. [[sed:vitae, [[semper:dolor]]]] lorem'),
				'Lorem ipsum dolor , consectetur adipiscing elit.  lorem'
			);
			done();
		});
	});
	describe('.escape/.unescape', () => {
		it('should escape translation patterns within text', (done) => {
			assert.strictEqual(
				Translator.escape('some nice text [[global:home]] here'),
				'some nice text &lsqb;&lsqb;global:home&rsqb;&rsqb; here'
			);
			done();
		});

		it('should escape all translation patterns within text', (done) => {
			assert.strictEqual(
				Translator.escape('some nice text [[global:home]] here and [[global:search]] there'),
				'some nice text &lsqb;&lsqb;global:home&rsqb;&rsqb; here and &lsqb;&lsqb;global:search&rsqb;&rsqb; there'
			);
			done();
		});

		it('should unescape escaped translation patterns within text', (done) => {
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

		// TODO: fixing this causes other issues with escaping tx strings
		/*
		translator escape works by escaping [[ and ]] separately, if its changed to be more strict to
		fix markdown links like [link text [test]](https://example.org)
		then it doesnt escape unclosed tx string like `[[topic:merged-message, javascript:alert('ok'), foo more text`
		this causes the html to break because translator goes on until it finds a closing `]]`
		and translates the entire thing using everything between as an argument.
		to test it out set your fullname to `[[topic:merged-message, javascript:alert('ok'), foo more text`

		it('should not escape markdown links', (done) => {
			assert.strictEqual(
				Translator.escape('[link text [test]](https://example.org)'),
				'[link text [test]](https://example.org)'
			);
			done();
		});

		// TODO: fixing this causes other issues with escaping tx strings
		it('should not unescape markdown links', (done) => {
			assert.strictEqual(
				Translator.unescape('&lsqblink text &lsqbtest&rsqb;&rsqb;(https://example.org)'),
				'&lsqblink text &lsqbtest&rsqb;&rsqb;(https://example.org)'
			);
			done();
		});*/
	});

	describe('.compile', () => {
		it('should create a translator pattern from a key and list of arguments', (done) => {
			assert.strictEqual(
				Translator.compile('amazing:cool', 'awesome', 'great'),
				'[[amazing:cool, awesome, great]]'
			);
			done();
		});

		it('should escape `%` and `,` in arguments', (done) => {
			assert.strictEqual(
				Translator.compile('amazing:cool', '100% awesome!', 'one, two, and three'),
				'[[amazing:cool, 100&#37; awesome!, one&#44; two&#44; and three]]'
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
