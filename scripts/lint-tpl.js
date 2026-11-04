#!/usr/bin/env node
'use strict';

/*
 * Lints NodeBB .tpl (Benchpress) templates for bare, un-internationalized text.
 *
 * A text node that still contains literal text (at least one letter) after all
 * template constructs are stripped is flagged. The correct form is a
 * {{tx("namespace:key", …)}} helper (or a [[namespace:key]] token); anything
 * else visible to the user should be wrapped in one.
 *
 * Attribute values are intentionally NOT checked: NodeBB writes {{tx("…")}}
 * inside double-quoted attributes, which is invalid HTML and mis-parses, and
 * most attribute values (option/input value, meta content) are data, not text.
 *
 * Usage: node scripts/lint-tpl.js <file.tpl> [more.tpl …]
 * Exits 1 if any findings, 0 otherwise (wired into lint-staged).
 */

const fs = require('fs');
const parse5 = require('parse5');

// Elements whose text content is code/markup, not user-facing UI text.
// <noscript> is included because parse5 parses its content as raw text in a
// fragment, so the inner markup can't be analyzed — internationalize it by hand.
const RAW_ELEMENTS = new Set(['script', 'style', 'textarea', 'template', 'noscript']);

// Directories whose templates are intentionally not internationalized. The
// install wizard runs before the forum is set up and uses a standalone
// Benchpress engine with no tx() helper; partials/data/* are pure
// attribute/JSON-LD fragments, not user-facing text.
const IGNORED_DIRS = [/\/install\//, /\/partials\/data\//];

function isIgnored(filePath) {
	return IGNORED_DIRS.some((re) => re.test(filePath));
}

// Strip every template construct, leaving only literal UI text. Order matters:
// triple-brace before double-brace before single-brace, so `{{{ }}}` is not
// mangled by the `{{ }}` rule. `{{tx(…)}}` and `[[…]]` are the OK forms.
function stripTemplateSyntax(str) {
	return str
		.replace(/\{\{\{[\s\S]*?\}\}\}/g, ' ') // {{{ … }}}  Benchpress control (if/each/end)
		.replace(/\{\{\s*tx\s*\([\s\S]*?\)\}\}/g, ' ') // {{tx(…)}}  internationalized helper
		.replace(/\{\{[\s\S]*?\}\}/g, ' ') // {{ … }}  other Benchpress expressions
		.replace(/\{[^{}]*\}/g, ' ') // { … }  {./value}, {config.foo}, …
		.replace(/\[\[[\s\S]*?\]\]/g, ' '); // [[ … ]]  translator tokens
}

function bareText(str) {
	return stripTemplateSyntax(str).trim();
}

function lintFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf8');
	const fragment = parse5.parseFragment(content, { sourceCodeLocationInfo: true });
	const findings = [];

	function walk(node, ignored) {
		if (node.nodeName === '#text') {
			if (ignored) {
				return;
			}
			const bare = bareText(node.value);
			// Translatable text must contain a letter; bare symbols/digits
			// (separators like "/", ")", "%") are not user-facing text.
			if (bare !== '' && /\p{L}/u.test(bare)) {
				findings.push({ line: node.sourceCodeLocation.startLine, col: node.sourceCodeLocation.startCol, kind: 'text', snippet: bare });
			}
			return;
		}

		if (node.nodeName === '#comment') {
			return;
		}

		// Do not descend into raw-content elements (their text is code/markup).
		if (RAW_ELEMENTS.has(node.tagName || node.nodeName)) {
			return;
		}

		// An element marked data-tpl-lint-ignore suppresses findings in its
		// subtree (technical values like CSP directives, CSS keywords, URLs, units).
		const nextIgnored = ignored || !!(node.attrs && node.attrs.some((a) => a.name === 'data-tpl-lint-ignore'));

		for (const child of node.childNodes || []) {
			walk(child, nextIgnored);
		}
	}

	walk(fragment, false);
	return findings;
}

function main() {
	const files = process.argv.slice(2);
	if (files.length === 0) {
		console.error('usage: lint-tpl.js <file.tpl> [more.tpl …]');
		process.exit(2);
	}

	let total = 0;
	for (const file of files) {
		if (isIgnored(file)) {
			continue;
		}
		let findings;
		try {
			findings = lintFile(file);
		} catch (e) {
			console.error(`${file}: failed to parse: ${e.message}`);
			process.exit(2);
		}
		for (const f of findings) {
			total += 1;
			const snippet = f.snippet.length > 60 ? `${f.snippet.slice(0, 57)}…` : f.snippet;
			console.log(`${file}:${f.line}:${f.col}  ${f.kind}  ${JSON.stringify(snippet)}`);
		}
	}

	if (total > 0) {
		console.log(`\n↳ internationalize: wrap the text in {{tx("file:key")}}`);
		process.exit(1);
	}
}

main();
