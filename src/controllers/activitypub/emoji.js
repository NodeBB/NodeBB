'use strict';

const fs = require('fs').promises;
const path = require('path');
const nconf = require('nconf');
const winston = require('winston');

const emoji = require('../../activitypub/emoji');

const Controller = module.exports;

/**
 * Serve a cached ActivityPub custom emoji image.
 * Route: GET /emoji/ap/:shortcode/:hostname
 */
Controller.serve = async (req, res) => {
	const { shortcode, hostname } = req.params;

	try {
		let metadata = await emoji.getEmoji(shortcode, hostname);
		if (!metadata || !metadata.localPath) {
			return res.sendStatus(404);
		}

		// Path traversal check
		const uploadPath = nconf.get('upload_path');
		if (!path.resolve(metadata.localPath).startsWith(path.resolve(uploadPath))) {
			winston.warn(`[activitypub:emoji] Path traversal attempt blocked: ${metadata.localPath}`);
			return res.sendStatus(403);
		}

		// Check file exists; re-download from remote if stale
		let filePath = metadata.localPath;
		try {
			await fs.access(filePath);
		} catch {
			// File missing on disk — clear stale Redis entry and re-download
			if (metadata.remoteUrl) {
				winston.info(`[activitypub:emoji] Re-downloading stale emoji ${shortcode} from ${metadata.remoteUrl}`);
				await emoji.deleteEmoji(shortcode, hostname);
				const tag = { name: shortcode, icon: { url: metadata.remoteUrl, mediaType: metadata.mediaType } };
				metadata = await emoji.cacheEmoji(tag);
				if (!metadata || !metadata.localPath) {
					return res.sendStatus(404);
				}
				filePath = metadata.localPath;
			} else {
				return res.sendStatus(404);
			}
		}

		const mediaType = metadata.mediaType || 'image/png';
		res.setHeader('Content-Type', mediaType);
		res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
		res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());

		// Stream the file
		const { createReadStream } = require('fs');
		const stream = createReadStream(filePath);
		stream.pipe(res);

		stream.on('error', (err) => {
			winston.warn(`[activitypub:emoji] Error serving file: ${err.message}`);
			if (!res.headersSent) {
				res.sendStatus(500);
			}
		});
	} catch (err) {
		winston.warn(`[activitypub:emoji] Error in serve: ${err.message}`);
		if (!res.headersSent) {
			res.sendStatus(500);
		}
	}
};
