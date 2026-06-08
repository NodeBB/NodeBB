#!/usr/bin/env node
'use strict';

/**
 * Mirror files from `patches/<package>/...` into `node_modules/<package>/...`.
 *
 * NodeBB's feat-kysely branch ships a kysely-aware adapter for the
 * `nodebb-plugin-dbsearch` plugin (which upstream only knows about mongo /
 * postgres / redis). We persist that file via a tracked patch tree and
 * re-apply it whenever someone runs `npm install`.
 *
 * Lighter-weight than `patch-package`: no diff format, no dev-dep bloat;
 * just a recursive file copy. Safe to run repeatedly.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PATCH_ROOT = path.join(ROOT, 'patches');
const NODE_MODULES = path.join(ROOT, 'node_modules');

function copyRecursive(srcDir, destDir) {
	if (!fs.existsSync(srcDir)) return;
	if (!fs.existsSync(destDir)) {
		// If the target package isn't installed, we silently skip — npm will
		// log the missing package itself.
		return;
	}
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const src = path.join(srcDir, entry.name);
		const dest = path.join(destDir, entry.name);
		if (entry.isDirectory()) {
			fs.mkdirSync(dest, { recursive: true });
			copyRecursive(src, dest);
		} else {
			fs.copyFileSync(src, dest);
		}
	}
}

function main() {
	if (!fs.existsSync(PATCH_ROOT)) return;
	if (!fs.existsSync(NODE_MODULES)) return;
	const packages = fs.readdirSync(PATCH_ROOT, { withFileTypes: true })
		.filter(e => e.isDirectory())
		.map(e => e.name);
	for (const pkg of packages) {
		const src = path.join(PATCH_ROOT, pkg);
		const dest = path.join(NODE_MODULES, pkg);
		if (!fs.existsSync(dest)) {
			process.stderr.write(`[apply-patches] skipping ${pkg}: not installed\n`);
			continue;
		}
		copyRecursive(src, dest);
		process.stdout.write(`[apply-patches] applied ${pkg}\n`);
	}
}

main();
