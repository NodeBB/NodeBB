'use strict';

// For tests relating to the translator module, check translator.js

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const file = require('../src/file');
const icu = require('../public/src/modules/icu.common');

const db = require('./mocks/databasemock');

const SOURCE_LANGUAGE = 'en-GB';

// Localisations live in Transifex and are pulled into the repository out-of-band, so the
// checks that walk the non-source language directories are only meaningful post-merge.
// Pull request CI keeps every other test (source language structure, .tx/config, key
// validity) running, so PRs are gated on the source strings themselves.
function inPrCI() {
	return (process.env.GITHUB_REF && process.env.GITHUB_REF !== 'refs/heads/develop') ||
		process.env.GITHUB_EVENT_NAME === 'pull_request';
}

describe('i18n', () => {
	let folders;

	before(async () => {
		folders = await fs.promises.readdir(path.resolve(__dirname, '../public/language'));
		folders = folders.filter(f => f !== 'README.md');
	});

	it('should contain folders named after the language code', async () => {
		const valid = /(?:README.md|^[a-z]{2}(?:-[A-Z]{2})?$|^[a-z]{2}(?:-x-[a-z]+)?$)/; // good luck

		folders.forEach((folder) => {
			assert(valid.test(folder));
		});
	});

	describe('.tx/config', () => {
		let blocks;

		before(() => {
			const raw = fs.readFileSync(path.resolve(__dirname, '../.tx/config'), 'utf8');
			blocks = [];
			let current = null;
			raw.split('\n').forEach((line) => {
				const header = line.match(/^\[(.+)\]$/);
				if (header) {
					current = { name: header[1], lines: [] };
					blocks.push(current);
				} else if (current && line.trim() !== '') {
					current.lines.push(line);
				}
			});
		});

		it('should start with a [main] block containing the Transifex host', () => {
			assert(blocks.length > 0, '.tx/config is empty');
			assert.strictEqual(blocks[0].name, 'main', `first block is [${blocks[0].name}], expected [main]`);
			assert(
				blocks[0].lines.some(line => line.trim() === 'host = https://www.transifex.com'),
				'[main] block is missing "host = https://www.transifex.com"'
			);
		});

		it('every other block should be a nodebb resource matching its source file name', () => {
			// resource names that do not match their file name, and why
			const exceptions = {
				'language-1': 'language is a reserved resource name in Transifex',
			};

			blocks.slice(1).forEach((block) => {
				const match = block.name.match(/^o:nodebb:p:nodebb:r:([a-z0-9_-]+)$/);
				assert(match, `Unexpected block header [${block.name}]`);
				if (exceptions[match[1]]) {
					return;
				}

				const source = block.lines.find(line => line.startsWith('source_file'));
				assert(source, `block [${block.name}] has no source_file`);
				const sourcePath = source.split('=').pop().trim();
				const prefix = 'public/language/en-GB/';
				assert(sourcePath.startsWith(prefix), `source_file "${sourcePath}" in [${block.name}] is not under public/language/en-GB/`);
				// the resource name is the file path (without the .json suffix), with slashes replaced by dashes
				const resource = sourcePath.slice(prefix.length).replace(/\.json$/, '').replace(/\//g, '-');
				assert.strictEqual(
					match[1],
					resource,
					`resource "${match[1]}" in [${block.name}] does not match its source file "${sourcePath}"`
				);
			});
		});

		it('every block should have the same number of translations', () => {
			const counts = blocks.slice(1).map(block => ({
				name: block.name,
				count: block.lines.filter(line => line.startsWith('trans.')).length,
			}));
			assert(counts.length > 0, 'no resource blocks found in .tx/config');
			const expected = counts[0].count;
			counts.forEach(({ name, count }) => {
				assert.strictEqual(count, expected, `block [${name}] has ${count} translations, expected ${expected}`);
			});
		});
	});

	// There has to be a better way to generate tests asynchronously...
	it('', async () => {
		const sourcePath = path.resolve(__dirname, '../public/language/en-GB');
		const fullPaths = await file.walk(sourcePath);
		const sourceFiles = fullPaths.map(path => path.replace(sourcePath, ''));
		const sourceStrings = new Map();

		describe('source language file structure', () => {
			const test = /^[a-zA-Z0-9-/]+(\.([0-9a-z]+([A-Z][0-9a-zA-Z]*)*-*\.?)+)*$/; // enhanced by chatgpt so only it knows what this does.

			it('should only contain valid JSON files', async () => {
				try {
					fullPaths.forEach((fullPath) => {
						if (fullPath.endsWith('_DO_NOT_EDIT_FILES_HERE.md')) {
							return;
						}

						const hash = require(fullPath);
						sourceStrings.set(fullPath.replace(sourcePath, ''), hash);
					});
				} catch (e) {
					assert(!e, `Invalid JSON found: ${e.message}`);
				}
			});

			it('should have well-formed ICU plural strings in the source language', () => {
				// A source string is an ICU message when it is a whole-string plural:
				// it starts with `{` and carries the `plural` type.
				const isICU = (value) => typeof value === 'string' && value.startsWith('{') && value.includes('plural');

				// Collect the argument names a string references via braced constructs
				// (the outer `{name, …}` selector plus inner `{name}` / `{%N}`), ignoring
				// category names and free text. Bare %N placeholders are not braced and are
				// substituted after rendering, so they are not arguments here.
				const argNames = (str) => {
					const names = [];
					const re = /\{([A-Za-z_%][A-Za-z0-9_%]*)\s*[,}]/g;
					let m;
					while ((m = re.exec(str)) !== null) {
						if (!names.includes(m[1])) {
							names.push(m[1]);
						}
					}
					return names;
				};

				sourceStrings.forEach((hash, relPath) => {
					Object.keys(hash).forEach((key) => {
						const value = hash[key];
						if (!isICU(value)) {
							return;
						}
						const names = argNames(value);
						// The first referenced name is the plural selector and must be numeric;
						// the rest are free-text values. Exercise both the "one" and "other"
						// branches so a malformed category in either is caught.
						const makeArgs = (count) => {
							const args = {};
							names.forEach((name, i) => {
								args[name] = i === 0 ? String(count) : `sample${i}`;
							});
							return args;
						};
						['1', '5'].forEach((count) => {
							try {
								icu.renderICU(value, makeArgs(count), 'en');
							} catch (e) {
								assert.fail(`${relPath.slice(1)}:${key} is not a well-formed ICU string: ${e.message}\n  ${value}`);
							}
						});
					});
				});
			});

			describe('should only contain lowercase or numeric language keys separated by either dashes or periods', async () => {
				describe('(regexp validation)', () => {
					const valid = [
						'foo.bar', 'foo.bar-baz', 'foo.bar.baz-quux-lorem-ipsum-dolor-sit-amet', 'foo.barBazQuux', // human generated
						'example-name.isValid', 'kebab-case.isGood', 'camelcase.isFine', 'camelcase.with-dashes.isAlsoFine', 'single-character.is-ok', 'abc.def', // chatgpt generated
					];
					const invalid = [
						// human generated
						'foo.PascalCase', 'foo.snake_case',
						'badger.badger_badger_badger',
						'foo.BarBazQuux',

						// chatgpt generated
						'!notValid', // Starts with a special character
						'with space.isInvalid', // Contains a space
						'.startsWithPeriod.isInvalid', // Starts with a period
						'invalid..case.isInvalid', // Consecutive periods
						'camelCase.With-Dashes.isAlsoInvalid', // PascalCase "With" is not allowed
					];

					valid.forEach((key) => {
						it(key, () => {
							assert(test.test(key));
						});
					});
					invalid.forEach((key) => {
						it(key, () => {
							assert(!test.test(key));
						});
					});
				});

				fullPaths.forEach((fullPath) => {
					if (fullPath.endsWith('_DO_NOT_EDIT_FILES_HERE.md')) {
						return;
					}

					const hash = require(fullPath);
					const keys = Object.keys(hash);

					keys.forEach((key) => {
						it(key, () => {
							assert(test.test(key), `${key} contains invalid characters`);
						});
					});
				});
			});
		});

		folders.forEach((language) => {
			describe(`"${language}"`, function () {
				if (language !== SOURCE_LANGUAGE && inPrCI()) {
					before(function () {
						this.skip();
					});
				}

				describe('file structure', () => {
					let files;

					before(async () => {
						const translationPath = path.resolve(__dirname, `../public/language/${language}`);
						files = (await file.walk(translationPath)).map(path => path.replace(translationPath, ''));
					});

					it('translations should contain every language file contained in the source language directory', () => {
						sourceFiles.forEach((relativePath) => {
							assert(files.includes(relativePath), `${relativePath.slice(1)} was found in source files but was not found in language "${language}" (likely not internationalized)`);
						});
					});

					it('should not contain any extraneous files not included in the source language directory', () => {
						files.forEach((relativePath) => {
							assert(sourceFiles.includes(relativePath), `${relativePath.slice(1)} was found in language "${language}" but there is no source file for it (likely removed from en-GB)`);
						});
					});

					it('language.json code should match the folder name', () => {
						const langFile = path.resolve(__dirname, `../public/language/${language}/language.json`);
						const langData = require(langFile);
						assert.strictEqual(langData.code, language, `language.code "${langData.code}" does not match folder name "${language}"`);
					});

					it('language.json dir should be either "ltr" or "rtl"', () => {
						const langFile = path.resolve(__dirname, `../public/language/${language}/language.json`);
						const langData = require(langFile);
						assert(['ltr', 'rtl'].includes(langData.dir), `language.dir "${langData.dir}" is not "ltr" or "rtl"`);
					});
				});

				describe('file contents', () => {
					let fullPaths;
					const translationPath = path.resolve(__dirname, `../public/language/${language}`);
					const strings = new Map();

					before(async () => {
						fullPaths = await file.walk(translationPath);
					});

					it('should contain only valid JSON files', () => {
						try {
							fullPaths.forEach((fullPath) => {
								if (fullPath.endsWith('_DO_NOT_EDIT_FILES_HERE.md')) {
									return;
								}

								const hash = require(fullPath);
								strings.set(fullPath.replace(translationPath, ''), hash);
							});
						} catch (e) {
							assert(!e, `Invalid JSON found: ${e.message}`);
						}
					});

					it('should contain every translation key contained in its source counterpart', () => {
						const sourceArr = Array.from(sourceStrings.keys());
						sourceArr.forEach((namespace) => {
							const sourceKeys = Object.keys(sourceStrings.get(namespace));
							const translationKeys = Object.keys(strings.get(namespace));

							assert(sourceKeys && translationKeys);
							sourceKeys.forEach((key) => {
								assert(translationKeys.includes(key), `${namespace.slice(1, -5)}:${key} missing in ${language}`);
							});
							assert.strictEqual(
								sourceKeys.length,
								translationKeys.length,
								`Extra keys found in namespace "${namespace.slice(1, -5)}" for language "${language}"`
							);
						});
					});
				});
			});
		});
	});
});
