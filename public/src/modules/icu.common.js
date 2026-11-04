'use strict';

/*
 * Hand-rolled renderer for the plural subset of ICU MessageFormat, rather than
 * a dependency. Transifex only round-trips that subset for JSON (KEYVALUEJSON);
 * the FormatJS packages are ESM-only, which would break this module's
 * synchronous server-side `require` across NodeBB's Node 22 range; and a
 * standard library rejects NodeBB's positional %N placeholders, which are not
 * valid ICU argument names.
 */

const pluralRulesCache = new Map();

function getPluralRules(locale) {
	if (!pluralRulesCache.has(locale)) {
		pluralRulesCache.set(locale, new Intl.PluralRules(locale));
	}
	return pluralRulesCache.get(locale);
}

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

// parses `name { message } name2 { message2 }` (messages may nest braces)
// into [[name, message], [name2, message2], …]
function parseCategories(str) {
	const categories = [];
	let i = 0;
	while (i < str.length) {
		while (i < str.length && /\s/.test(str[i])) {
			i++;
		}
		if (i >= str.length) {
			break;
		}
		const openIdx = str.indexOf('{', i);
		if (openIdx === -1) {
			throw new Error('Malformed ICU message: missing category body');
		}
		const name = str.slice(i, openIdx).trim();
		const closeIdx = findMatchingBrace(str, openIdx);
		if (closeIdx === -1) {
			throw new Error('Malformed ICU message: missing closing brace');
		}
		categories.push([name, str.slice(openIdx + 1, closeIdx)]);
		i = closeIdx + 1;
	}
	return categories;
}

// renders the inside of a `{ … }` argument
function renderArgument(body, args, locale) {
	const fields = splitTopLevel(body, ',').map(field => field.trim());
	const name = fields[0];
	const type = fields[1];

	if (!type) {
		if (!(name in args)) {
			throw new Error(`Missing argument "${name}"`);
		}
		return args[name];
	}

	if (type !== 'plural') {
		throw new Error(`Unsupported ICU argument type "${type}"`);
	}
	const categories = parseCategories(fields.slice(2).join(','));
	const value = Number(args[name]);
	const category = Number.isFinite(value) ? getPluralRules(locale).select(value) : 'other';

	let selected = categories.find(([cat]) => cat === category);
	if (!selected) {
		selected = categories.find(([cat]) => cat === 'other');
	}
	if (!selected) {
		throw new Error(`Missing "${category}" (or "other") category for "${name}"`);
	}
	return renderMessage(selected[1], args, locale);
}

function renderMessage(message, args, locale) {
	message = message.trim();
	if (!message.includes('{')) {
		return message;
	}

	let output = '';
	let i = 0;
	while (i < message.length) {
		const openIdx = message.indexOf('{', i);
		if (openIdx === -1) {
			output += message.slice(i);
			break;
		}
		output += message.slice(i, openIdx);
		const closeIdx = findMatchingBrace(message, openIdx);
		if (closeIdx === -1) {
			throw new Error('Malformed ICU message: missing closing brace');
		}
		output += renderArgument(message.slice(openIdx + 1, closeIdx), args, locale);
		i = closeIdx + 1;
	}
	return output;
}

/**
 * Render an ICU MessageFormat string.
 * @param {string} message - ICU message (argument names must be valid identifiers)
 * @param {Object<string, string>} args - already-escaped argument values
 * @param {string} locale - BCP-47 locale used for plural category selection
 * @returns {string}
 */
function renderICU(message, args = {}, locale = 'en') {
	return renderMessage(message, args, locale);
}

module.exports = {
	renderICU,
};
