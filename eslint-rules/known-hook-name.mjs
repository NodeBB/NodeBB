import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Hook names are plain strings matched at runtime -- `plugins.hooks.fire()` looks
 * the name up in `loadedHooks` and runs whatever is there. Nothing validates the
 * name, so a typo does not throw: the hook simply never has listeners, and a
 * filter hook returns its payload untouched. That is deliberate (it is what lets
 * a hook work with no plugin listening), but it means a misspelled name in core
 * is invisible -- the feature just quietly does nothing.
 *
 * This rule checks names fired in core against src/plugins/hooks.json, which is
 * the list of hooks core fires -- effectively the plugin API surface. Adding a
 * hook means adding a line to that file, so a new entry shows up in review as
 * "this is new public API", and a rename shows up as a removal plus an addition,
 * which is what breaks third-party plugins.
 *
 * Only fully static names are checked. The handful of names built from template
 * expressions (`filter:post.${type}` and friends) are skipped -- there is nothing
 * to compare them against.
 */

const manifestPath = path.join(
	fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'plugins', 'hooks.json'
);
const knownHooks = new Set(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));

// `plugins.hooks.fire(...)`, `Plugins.hooks.fire(...)` and the `Hooks.fire(...)`
// calls inside the hooks module itself
function isHookFire(callee) {
	if (callee.type !== 'MemberExpression' || callee.computed) {
		return false;
	}
	if (callee.property.type !== 'Identifier' || callee.property.name !== 'fire') {
		return false;
	}
	const receiver = callee.object;
	if (receiver.type === 'Identifier') {
		return /^hooks$/i.test(receiver.name);
	}
	return receiver.type === 'MemberExpression' &&
		!receiver.computed &&
		receiver.property.type === 'Identifier' &&
		/^hooks$/i.test(receiver.property.name);
}

// a template literal with no interpolation is just a string
function staticName(node) {
	if (node.type === 'Literal' && typeof node.value === 'string') {
		return node.value;
	}
	if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
		return node.quasis[0].value.cooked;
	}
	return null;
}

export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'require hook names fired in core to be listed in src/plugins/hooks.json',
		},
		schema: [],
		messages: {
			unknown: "Unknown hook name '{{name}}'. Nothing validates hook names at runtime, so a typo here fails silently. If this hook is new, add it to src/plugins/hooks.json in the same commit.",
		},
	},

	create(context) {
		return {
			CallExpression(node) {
				if (!isHookFire(node.callee) || !node.arguments.length) {
					return;
				}
				const name = staticName(node.arguments[0]);
				if (name === null || knownHooks.has(name)) {
					return;
				}
				context.report({ node: node.arguments[0], messageId: 'unknown', data: { name } });
			},
		};
	},
};
