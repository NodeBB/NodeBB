'use strict';

import nconf from 'nconf';
import winston from 'winston';
const validator = require('validator');
const translator = require('../translator');
const plugins = require('../plugins');
const middleware = require('../middleware');
const middlewareHelpers = require('../middleware/helpers');
const helpers = require('./helpers').defualt;

export const handleURIErrors = async function handleURIErrors(err: Error, req, res, next: Function) {
	// Handle cases where malformed URIs are passed in
	if (err instanceof URIError) {
		const cleanPath = req.path.replace(new RegExp(`^${nconf.get('relative_path')}`), '');
		const tidMatch = cleanPath.match(/^\/topic\/(\d+)\//);
		const cidMatch = cleanPath.match(/^\/category\/(\d+)\//);

		if (tidMatch) {
			res.redirect(nconf.get('relative_path') + tidMatch[0]);
		} else if (cidMatch) {
			res.redirect(nconf.get('relative_path') + cidMatch[0]);
		} else {
			winston.warn(`[controller] Bad request: ${req.path}`);
			if (req.path.startsWith(`${nconf.get('relative_path')}/api`)) {
				res.status(400).json({
					error: '[[global:400.title]]',
				});
			} else {
				await middleware.buildHeaderAsync(req, res);
				res.status(400).render('400', { error: validator.escape(String(err.message)) });
			}
		}
	} else {
		next(err);
	}
};

// this needs to have four arguments or express treats it as `(req, res, next)`
// don't remove `next`!
export const handleErrors = async function handleErrors(err, req, res, next: Function) { // eslint-disable-line no-unused-vars
	const cases = {
		EBADCSRFTOKEN: function () {
			winston.error(`${req.method} ${req.originalUrl}\n${err.message}`);
			res.sendStatus(403);
		},
		'blacklisted-ip': function () {
			res.status(403).type('text/plain').send(err.message);
		},
	} as any;
	const defaultHandler = async function () {
		if (res.headersSent) {
			return;
		}
		// Display NodeBB error page
		const status = parseInt((err as any).status, 10);
		if ((status === 302 || status === 308) && (err as any).path) {
			return res.locals.isAPI ? res.set('X-Redirect', (err as any).path).status(200).json((err as any).path) : res.redirect(nconf.get('relative_path') + (err as any).path);
		}

		const path = String(req.path || '');

		if (path.startsWith(`${nconf.get('relative_path')}/api/v3`)) {
			let status = 500;
			if (err.message.startsWith('[[')) {
				status = 400;
				err.message = await translator.translate(err.message);
			}
			return helpers.formatApiResponse(status, res, err);
		}

		winston.error(`${req.method} ${req.originalUrl}\n${err.stack}`);
		res.status(status || 500);
		const data = {
			path: validator.escape(path),
			error: validator.escape(String(err.message)),
			bodyClass: middlewareHelpers.buildBodyClass(req, res),
		} as any;
		if (res.locals.isAPI) {
			res.json(data);
		} else {
			await middleware.buildHeaderAsync(req, res);
			res.render('500', data);
		}
	};
	const data = await getErrorHandlers(cases);
	try {
		if (data.cases.hasOwnProperty((err as any).code)) {
			data.cases[(err as any).code](err, req, res, defaultHandler);
		} else {
			await defaultHandler();
		}
	} catch (_err: any) {
		winston.error(`${req.method} ${req.originalUrl}\n${_err.stack}`);
		if (!res.headersSent) {
			res.status(500).send(_err.message);
		}
	}
};

async function getErrorHandlers(cases) {
	try {
		return await plugins.hooks.fire('filter:error.handle', {
			cases: cases,
		});
	} catch (err: any) {
		// Assume defaults
		winston.warn(`[errors/handle] Unable to retrieve plugin handlers for errors: ${err.message}`);
		return { cases };
	}
}
