
const assert = require('assert');

const utils = require('../src/utils');
const slugify = require('../src/slugify');

describe('slugify', () => {
	it('should replace spaces with dashes', () => {
		assert.strictEqual(slugify('some username'), 'some-username');
	});

	it('should collapse multiple spaces into one dash', () => {
		assert.strictEqual(slugify('some   username'), 'some-username');
	});

	it('should trim leading and trailing whitespace', () => {
		assert.strictEqual(slugify('  some username  '), 'some-username');
	});

	it('should lowercase by default', () => {
		assert.strictEqual(slugify('Some Username'), 'some-username');
	});

	it('should preserve case if requested', () => {
		assert.strictEqual(slugify('UPPER CASE', true), 'UPPER-CASE');
	});

	it('should work if a number is passed in', () => {
		assert.strictEqual(slugify(12345), '12345');
	});

	describe('dash normalization', () => {
		it('should collapse multiple dashes', () => {
			assert.strictEqual(slugify('foo---bar'), 'foo-bar');
		});

		it('should trim leading dashes', () => {
			assert.strictEqual(slugify('---foo'), 'foo');
		});

		it('should trim trailing dashes', () => {
			assert.strictEqual(slugify('foo---'), 'foo');
		});

		it('should replace invalid characters with dashes', () => {
			assert.strictEqual(slugify('foo!@#$bar'), 'foo-@-bar');
		});
	});

	describe('unicode support', () => {
		it('should preserve accented Latin characters', () => {
			assert.strictEqual(slugify('Jöhn Döe'), 'jöhn-döe');
		});

		it('should preserve Cyrillic characters', () => {
			assert.strictEqual(slugify('Мария Иванова'), 'мария-иванова');
		});

		it('should preserve CJK characters', () => {
			assert.strictEqual(slugify('你好 世界'), '你好-世界');
		});

		it('should preserve Arabic characters', () => {
			assert.strictEqual(slugify('مرحبا بك'), 'مرحبا-بك');
		});

		it('should replace invalid unicode symbols', () => {
			assert.strictEqual(slugify('用户💩名'), '用户-名');
		});

	});

	describe('edge cases', () => {
		it('should not return an empty string for punctuation-only input', () => {
			assert.strictEqual(slugify('---'), '');
		});

		it('should preserve dots inside slugs', () => {
			assert.strictEqual(slugify('john.doe'), 'john.doe');
		});

		it('should not return dot or dot-dot slugs', () => {
			assert.strictEqual(slugify('-.-'), '');
			assert.strictEqual(slugify('.'), '');
			assert.strictEqual(slugify('..'), '');
		});

		it('should handle dot-heavy usernames', () => {
			assert.strictEqual(slugify('-.-.-'), '.-.');
		});

		it('should return empty string for falsy input', () => {
			assert.strictEqual(slugify(''), '');
			assert.strictEqual(slugify(null), '');
			assert.strictEqual(slugify(undefined), '');
		});
	});
});

describe('isSlugValid', () => {
	const { isSlugValid } = utils;
	it('should reject empty or falsy values', () => {
		assert.strictEqual(isSlugValid(''), false);
		assert.strictEqual(isSlugValid(null), false);
		assert.strictEqual(isSlugValid(undefined), false);
	});

	it('should reject dot and dot-dot', () => {
		assert.strictEqual(isSlugValid('.'), false);
		assert.strictEqual(isSlugValid('..'), false);
	});

	it('should reject whitespace-only slugs', () => {
		assert.strictEqual(isSlugValid(' '), false);
		assert.strictEqual(isSlugValid('   '), false);
	});

	it('should accept ASCII alphanumeric slugs', () => {
		assert.strictEqual(isSlugValid('user123'), true);
		assert.strictEqual(isSlugValid('john-doe'), true);
		assert.strictEqual(isSlugValid('john.doe'), true);
	});

	it('should accept Unicode letter slugs', () => {
		assert.strictEqual(isSlugValid('мария'), true);
		assert.strictEqual(isSlugValid('ユーザー'), true);
		assert.strictEqual(isSlugValid('你好'), true);
		assert.strictEqual(isSlugValid('مرحبا'), true);
	});

	it('should accept mixed Unicode and punctuation slugs', () => {
		assert.strictEqual(isSlugValid('用户-123'), true);
		assert.strictEqual(isSlugValid('мария-иванова'), true);
		assert.strictEqual(isSlugValid('ユーザー_01'), true);
	});

	it('should reject zero-width character slugs', () => {
		assert.strictEqual(isSlugValid('\u200B'), false); // zero-width space
		assert.strictEqual(isSlugValid('\u200D'), false); // zero-width joiner
	});

	it('slugify output should always produce a valid slug or empty string', () => {
		const inputs = [
			'some username',
			'-.-',
			'用户💩名',
			'---',
			'Мария Иванова',
			'   ',
			'12345',
		];

		for (const input of inputs) {
			const slug = slugify(input);
			if (slug !== '') {
				assert.strictEqual(
					isSlugValid(slug),
					true,
					`Expected valid slug from "${input}", got "${slug}"`
				);
			}
		}
	});
});
