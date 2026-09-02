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
		const metadata = await emoji.getEmoji(shortcode, hostname);
		if (!metadata || !metadata.localPath) {
			return res.sendStatus(404);
		}

		// Path traversal check
		const uploadPath = nconf.get('upload_path');
		if (!path.resolve(metadata.localPath).startsWith(path.resolve(uploadPath))) {
			winston.warn(`[activitypub:emoji] Path traversal attempt blocked: ${metadata.localPath}`);
			return res.sendStatus(403);
		}

		// Check file exists
		try {
			await fs.access(metadata.localPath);
		} catch {
			// File may have been deleted from disk but still in Redis
			return res.sendStatus(404);
		}

		const mediaType = metadata.mediaType || 'image/png';
		res.setHeader('Content-Type', mediaType);
		res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
		res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());

		// Stream the file
		const { createReadStream } = require('fs');
		const stream = createReadStream(metadata.localPath);
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
