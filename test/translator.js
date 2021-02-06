'use strict';


const assert = require('assert');
const shim = require('../public/src/modules/translator.js');

const { Translator } = shim;
const db = require('./mocks/databasemock');

describe('Translator shim', () => {
	describe('.translate()', () => {
		it('should translate correctly', (done) => {
			shim.translate('[[global:pagination.out_of, (foobar), [[global:home]]]]', (translated) => {
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

			return translator.translate('[[global:pagination.out_of, 1, 5]]').then((translated) => {
				assert.strictEqual(translated, '1 out of 5');
			});
		});

		it('should handle language keys inside language keys', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[notifications:outgoing_link_message, [[global:guest]]]]').then((translated) => {
				assert.strictEqual(translated, 'You are now leaving Guest');
			});
		});

		it('should handle language keys inside language keys with multiple parameters', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[notifications:user_posted_to, [[global:guest]], My Topic]]').then((translated) => {
				assert.strictEqual(translated, '<strong>Guest</strong> has posted a reply to: <strong>My Topic</strong>');
			});
		});

		it('should handle language keys inside language keys with all parameters as language keys', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[notifications:user_posted_to, [[global:guest]], [[global:guest]]]]').then((translated) => {
				assert.strictEqual(translated, '<strong>Guest</strong> has posted a reply to: <strong>Guest</strong>');
			});
		});

		it('should properly handle parameters that contain square brackets', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[global:pagination.out_of, [guest], [[global:home]]]]').then((translated) => {
				assert.strictEqual(translated, '[guest] out of Home');
			});
		});

		it('should properly handle parameters that contain parentheses', () => {
			const translator = Translator.create('en-GB');

			return translator.translate('[[global:pagination.out_of, (foobar), [[global:home]]]]').then((translated) => {
				assert.strictEqual(translated, '(foobar) out of Home');
			});
		});

		it('should escape language key parameters with HTML in them', () => {
			const translator = Translator.create('en-GB');

			const key = '[[global:403.login, <strong>test</strong>]]';
			return translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'Perhaps you should <a href=\'&lt;strong&gt;test&lt;/strong&gt;/login\'>try logging in</a>?');
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

			const key = '[[notifications:upvoted_your_post_in, test1, error: Error: &lsqb;&lsqb;error:group-name-too-long&rsqb;&rsqb; on NodeBB Upgrade]]';
			return translator.translate(key).then((translated) => {
				assert.strictEqual(translated, '<strong>test1</strong> has upvoted your post in <strong>error: Error: &lsqb;&lsqb;error:group-name-too-long&rsqb;&rsqb; on NodeBB Upgrade</strong>.');
			});
		});

		it('should properly escape and ignore % and \\, in arguments', () => {
			const translator = Translator.create('en-GB');

			const title = 'Test 1\\, 2\\, 3 %2 salmon';
			const key = `[[topic:composer.replying_to, ${title}]]`;
			return translator.translate(key).then((translated) => {
				assert.strictEqual(translated, 'Replying to Test 1&#44; 2&#44; 3 &#37;2 salmon');
			});
		});

		it('should not escape regular %', () => {
			const translator = Translator.create('en-GB');

			const title = '3 % salmon';
			const key = `[[topic:composer.replying_to, ${title}]]`;
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
	describe('.escape', () => {
		it('should escape translation patterns within text', (done) => {
			assert.strictEqual(
				Translator.escape('some nice text [[global:home]] here'),
				'some nice text &lsqb;&lsqb;global:home&rsqb;&rsqb; here'
			);
			done();
		});
	});

	describe('.unescape', () => {
		it('should unescape escaped translation patterns within text', (done) => {
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
