'use strict';

/*
 * Detection of the "(s)" plural hack in the source language files
 * (public/language/en-GB), shared by the two nudges:
 *
 *  - the eslint rule registered in eslint.config.mjs (`nodebb/i18n-icu-plural`),
 *    which reports every offending string in the source language as the file is
 *    edited (IDE squiggles), and
 *  - the commitlint rule in scripts/commitlint-plugin-i18n-plural.js
 *    (`i18n-icu-plural`), which reports only the strings a commit adds.
 *
 * `User(s)` cannot be inflected by languages with more than one plural form, so
 * source strings should use an ICU plural instead — see .github/CONTRIBUTING.md#plurals.
 */

const { execFileSync } = require('child_process');

const SOURCE_LANGUAGE_DIR = 'public/language/en-GB';

// A word glued to a parenthesised "s", e.g. "User(s)", "%1 minute(s)".
const PLURAL_HACK = /\w\(\s*s\)/;

// `"key": "value"` — translation values are single-line JSON strings.
const JSON_KEY = /^\s*"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"/;

const EXAMPLE = '"{count, plural, one {Ban {count} user.} other {Ban {count} users.}}"';

const GUIDANCE = 'Languages have more than one plural form, so "(s)" cannot be translated. Use an ICU plural instead, duplicating the whole sentence into each branch:';

const isPluralHack = value => typeof value === 'string' && PLURAL_HACK.test(value);

// One-line report for a single string, as eslint reports per node.
function describeString(key) {
	return `Avoid the "(s)" plural hack ("${key}"): use an ICU plural, duplicating the whole sentence into each branch, e.g. ${EXAMPLE}`;
}

// A single report enumerating every offender, as commitlint reports per commit.
function describeOffenders(offenders) {
	const lines = offenders.map(o => `    ${o.file} → "${o.key}": "${o.value}"`);

	return [
		`${offenders.length} source string(s) in ${SOURCE_LANGUAGE_DIR} use the "(s)" plural hack:`,
		...lines,
		'',
		GUIDANCE,
		`    ${EXAMPLE}`,
	].join('\n');
}

// The staged diff of the source language directory, one entry per offending key.
function stagedSourceStrings() {
	let diff;
	try {
		diff = execFileSync(
			'git',
			['diff', '--cached', '-U0', '--', SOURCE_LANGUAGE_DIR],
			{ encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
		);
	} catch (e) {
		// Not a git checkout, git unavailable, etc. — nothing to check.
		return [];
	}

	const offenders = [];
	const seen = new Set();
	let file = null;

	diff.split('\n').forEach((line) => {
		if (line.startsWith('+++ ')) {
			const target = line.slice(4).trim();
			file = target.startsWith('b/') ? target.slice(2) : target;
			if (!file.endsWith('.json')) {
				file = null;
			}
			return;
		}

		if (!file || !line.startsWith('+')) {
			return;
		}

		const content = line.slice(1);
		if (!isPluralHack(content)) {
			return;
		}

		const match = content.match(JSON_KEY);
		const id = `${file}:${match ? match[1] : ''}`;
		if (seen.has(id)) {
			return;
		}
		seen.add(id);

		offenders.push({
			file: file.replace(`${SOURCE_LANGUAGE_DIR}/`, ''),
			key: match ? match[1] : '(unkeyed)',
			value: match ? match[2] : content.trim(),
		});
	});

	return offenders;
}

module.exports = {
	SOURCE_LANGUAGE_DIR,
	isPluralHack,
	describeString,
	describeOffenders,
	stagedSourceStrings,
};
