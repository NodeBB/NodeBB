'use strict';

const path = require('path');
const fs = require('fs').promises;
const nconf = require('nconf');
const mime = require('mime').default;
const winston = require('winston');

const db = require('../database');
const validator = require('validator');
const request = require('../request');

const emojiLookupKey = 'emoji:ap:lookup';

// The only extensions we are willing to persist for a cached emoji image.
const ALLOWED_EMOJI_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg']);

function getEmojiDir() {
	const uploadPath = nconf.get('upload_path') || nconf.get('base_dir') || '.';
	return path.join(uploadPath, 'emoji', 'ap');
}

/**
 * Extract hostname from an emoji's icon URL or id.
 */
function extractHostname(icon) {
	if (!icon || !icon.url) {
		return null;
	}
	try {
		return new URL(icon.url).hostname;
	} catch {
		return null;
	}
}

/**
 * Build the Redis field key for a shortcode+hostname pair.
 */
function buildFieldKey(shortcode, hostname) {
	// Strip leading/trailing colons from shortcode for the key
	const clean = shortcode.replace(/^:+|:+$/g, '');
	return `${clean}:${hostname}`;
}

/**
 * Normalize a shortcode to :name: format.
 */
function normalizeShortcode(name) {
	let short = name;
	if (!short.startsWith(':')) {
		short = `:${short}`;
	}
	if (!short.endsWith(':')) {
		short = `${short}:`;
	}
	return short;
}

/**
 * Lookup a cached emoji by shortcode and hostname.
 * Returns { name, remoteUrl, localPath, mediaType } or null.
 */
async function getEmoji(shortcode, hostname) {
	const fieldKey = buildFieldKey(shortcode, hostname);
	const raw = await db.getObjectField(emojiLookupKey, fieldKey);
	if (!raw) {
		return null;
	}
	try {
		const metadata = JSON.parse(raw);
		// Resolve relative path to absolute
		if (metadata.localPath) {
			metadata.localPath = path.join(nconf.get('upload_path'), metadata.localPath);
		}
		return metadata;
	} catch {
		return null;
	}
}

/**
 * Download a remote emoji image and persist metadata in Redis.
 * Returns { name, remoteUrl, localPath, mediaType } on success, or null on failure.
 */
async function cacheEmoji(emojiTag) {
	const { name, icon } = emojiTag;
	if (!icon || !icon.url) {
		return null;
	}

	const hostname = extractHostname(icon);
	if (!hostname) {
		return null;
	}

	const shortcode = normalizeShortcode(name);
	const fieldKey = buildFieldKey(name, hostname);

	// Check if already cached
	const existing = await getEmoji(name, hostname);
	if (existing) {
		return existing;
	}

	let ext = (mime.getExtension(icon.mediaType || '') || path.extname(new URL(icon.url).pathname).slice(1) || 'png').toLowerCase();
	if (!ALLOWED_EMOJI_EXTS.has(ext)) {
		ext = 'png';
	}

	const cleanName = shortcode.replace(/^:+|:+$/g, '').replace(/[/\\]+/g, '_').replace(/\0/g, '');
	if (!cleanName) {
		return null;
	}
	const filename = `${cleanName}.${ext}`;
	const baseDir = getEmojiDir();
	const dirPath = path.join(baseDir, hostname);
	const localPath = path.join(dirPath, filename);

	const resolvedBase = path.resolve(baseDir);
	const resolved = path.resolve(localPath);
	if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
		return null;
	}

	try {
		// Ensure directory exists
		await fs.mkdir(dirPath, { recursive: true });

		// Fetch the remote image through the SSRF-protected request layer. This
		// pins DNS to the already-validated address (no rebind TOCTOU),
		// revalidates every redirect hop, and caps the response size.
		let buffer;
		let response;
		try {
			({ body: buffer, response } = await request.getBuffer(icon.url, { timeout: 5000 }));
			if (!response.ok) {
				winston.warn(`[activitypub:emoji] Failed to fetch emoji ${shortcode} from ${hostname}: HTTP ${response.status}`);
				return null;
			}
		} catch (err) {
			winston.warn(`[activitypub:emoji] Failed to fetch emoji ${shortcode} from ${hostname}: ${err.message}`);
			return null;
		}

		await fs.writeFile(localPath, buffer);

		const mediaType = icon.mediaType || mime.getType(ext) || 'image/png';
		// Store path relative to upload_path so it survives installation moves
		const relPath = path.relative(nconf.get('upload_path'), localPath);
		const metadata = {
			name: shortcode,
			remoteUrl: icon.url,
			localPath: relPath,
			mediaType,
		};

		await db.setObjectField(emojiLookupKey, fieldKey, JSON.stringify(metadata));

		return metadata;
	} catch (err) {
		winston.warn(`[activitypub:emoji] Error caching emoji ${shortcode} from ${hostname}:`, err.message);
		return null;
	}
}

/**
 * Get the proxy URL for a cached emoji.
 * Returns a URL path that routes through the emoji proxy controller.
 */
function getProxyUrl(shortcode, hostname) {
	const clean = shortcode.replace(/^:+|:+$/g, '');
	return `/emoji/ap/${encodeURIComponent(clean)}/${encodeURIComponent(hostname)}`;
}

/**
 * Process a single emoji tag: cache if needed, return img tag HTML.
 */
async function processEmojiTag(emojiTag) {
	const { name, icon } = emojiTag;
	if (!icon || !icon.url) {
		return null;
	}

	const hostname = extractHostname(icon);
	if (!hostname) {
		return icon.url; // fallback to remote
	}

	const isImage = !icon.mediaType || icon.mediaType.startsWith('image/');
	if (!isImage) {
		return icon.url; // not an image emoji
	}

	if (!validator.isURL(icon.url, { require_protocol: true, require_host: true })) {
		return null;
	}

	// Try to get cached or download
	const cached = await getEmoji(name, hostname);
	let metadata = cached;

	if (!cached) {
		metadata = await cacheEmoji(emojiTag);
	}

	if (metadata) {
		const shortcode = normalizeShortcode(name);
		const proxyUrl = getProxyUrl(shortcode, hostname);
		return `<img class="not-responsive emoji" src="${proxyUrl}" title="${shortcode}" />`;
	}

	// Fallback: use remote URL directly if caching failed
	return `<img class="not-responsive emoji" src="${icon.url}" title="${normalizeShortcode(name)}" />`;
}

/**
 * Delete a cached emoji entry from Redis.
 * Does not delete the on-disk file (stale files are pruned by re-download).
 */
async function deleteEmoji(shortcode, hostname) {
	const fieldKey = buildFieldKey(shortcode, hostname);
	await db.deleteObjectField(emojiLookupKey, fieldKey);
}

module.exports = {
	extractHostname,
	buildFieldKey,
	normalizeShortcode,
	getEmoji,
	cacheEmoji,
	deleteEmoji,
	getProxyUrl,
	processEmojiTag,
};
