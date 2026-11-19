'use strict';

/*
 * Detection of the "(s)" plural hack in the source language files
 * (public/language/en-GB), shared by the nudges:
 *
 *  - the eslint rules registered in eslint.config.mjs (`nodebb/i18n-icu-plural`
 *    as a suggestion/warn, and `nodebb/i18n-icu-syntax` as a problem/error),
 *    which report every offending string in the source language as the file is
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

// --- ICU syntax validation -------------------------------------------------
//
// Validates the plural subset of ICU MessageFormat that
// public/src/modules/icu.common.js renders: `{name}` argument references and
// `{name, plural, category {message} …}` with an `other` category. Messages
// may nest braces (e.g. `{count}` inside a plural branch). `select` and other
// argument types are not supported by the renderer.

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

// split on `separator` at brace depth 0
function splitTopLevel(str, separator) {
	const parts = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		if (char === '{') {
			depth++;
		} else if (char === '}') {
			depth--;
		} else if (char === separator && depth === 0) {
			parts.push(str.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(str.slice(start));
	return parts;
}

// index of the `}` matching the `{` at openIdx, or -1 if unbalanced
function findMatchingBrace(str, openIdx) {
	let depth = 0;
	for (let i = openIdx; i < str.length; i++) {
		if (str[i] === '{') {
			depth++;
		} else if (str[i] === '}') {
			depth--;
			if (depth === 0) {
				return i;
			}
		}
	}
	return -1;
}

// Validates the inside of a `{ … }` argument; returns an error string or null.
function validateArgument(body) {
	const fields = splitTopLevel(body, ',').map(field => field.trim());
	const name = fields[0];
	if (!IDENTIFIER.test(name)) {
		return `invalid argument name "${name}"`;
	}
	const type = fields[1];
	if (!type) {
		return null;
	}
	if (type !== 'plural') {
		return `unsupported ICU argument type "${type}"`;
	}

	const categories = [];
	const rest = fields.slice(2).join(',');
	let i = 0;
	while (i < rest.length) {
		while (i < rest.length && /\s/.test(rest[i])) {
			i++;
		}
		if (i >= rest.length) {
			break;
		}
		const openIdx = rest.indexOf('{', i);
		if (openIdx === -1) {
			return 'malformed plural: missing category body';
		}
		const category = rest.slice(i, openIdx).trim();
		if (!category) {
			return 'malformed plural: empty category name';
		}
		const closeIdx = findMatchingBrace(rest, openIdx);
		if (closeIdx === -1) {
			return 'missing closing brace';
		}
		categories.push(category);
		i = closeIdx + 1;
	}
	if (!categories.length) {
		return 'plural with no categories';
	}
	if (!categories.includes('other')) {
		return 'plural missing "other" category';
	}
	return null;
}

/**
 * Validate an ICU message (the plural subset rendered by icu.common.js).
 * @param {string} message
 * @returns {string|null} an error description, or null if the message is valid
 */
function validateICU(message) {
	let i = 0;
	while (i < message.length) {
		const char = message[i];
		if (char === '}') {
			return 'unbalanced closing brace';
		}
		if (char !== '{') {
			i++;
			continue;
		}
		const closeIdx = findMatchingBrace(message, i);
		if (closeIdx === -1) {
			return 'missing closing brace';
		}
		const problem = validateArgument(message.slice(i + 1, closeIdx));
		if (problem) {
			return problem;
		}
		i = closeIdx + 1;
	}
	return null;
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
	validateICU,
	stagedSourceStrings,
};
