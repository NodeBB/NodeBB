'use strict';

const fs = require('fs');
const nconf = require('nconf');
const winston = require('winston');
const validator = require('validator');
const path = require('path');
const translator = require('../translator');
const plugins = require('../plugins');
const middleware = require('../middleware');
const middlewareHelpers = require('../middleware/helpers');
const helpers = require('./helpers');

exports.handleURIErrors = async function handleURIErrors(err, req, res, next) {
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
exports.handleErrors = async function handleErrors(err, req, res, next) { // eslint-disable-line no-unused-vars
	const cases = {
		EBADCSRFTOKEN: function () {
			winston.error(`${req.method} ${req.originalUrl}\n${err.message}`);
			res.sendStatus(403);
		},
		'blacklisted-ip': function () {
			res.status(403).type('text/plain').send(err.message);
		},
	};

	const notFoundHandler = () => {
		const controllers = require('.');
		controllers['404'].handle404(req, res);
	};

	const notBuiltHandler = async () => {
		let file = await fs.promises.readFile(path.join(__dirname, '../../public/500.html'), { encoding: 'utf-8' });
		file = file.replace('{message}', 'Failed to lookup view! Did you run `./nodebb build`?');
		return res.type('text/html').send(file);
	};

	const defaultHandler = async function () {
		if (res.headersSent) {
			return;
		}
		// Display NodeBB error page
		const status = parseInt(err.status, 10);
		if ((status === 302 || status === 308) && err.path) {
			return res.locals.isAPI ? res.set('X-Redirect', err.path).status(200).json(err.path) : res.redirect(nconf.get('relative_path') + err.path);
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
		};
		if (res.locals.isAPI) {
			res.json(data);
		} else {
			await middleware.buildHeaderAsync(req, res);
			res.render('500', data);
		}
	};
	const data = await getErrorHandlers(cases);
	try {
		if (data.cases.hasOwnProperty(err.code)) {
			data.cases[err.code](err, req, res, defaultHandler);
		} else if (err.message.startsWith('[[error:no-') && err.message !== '[[error:no-privileges]]') {
			notFoundHandler();
		} else if (err.message.startsWith('Failed to lookup view')) {
			notBuiltHandler();
		} else {
			await defaultHandler();
		}
	} catch (_err) {
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
	} catch (err) {
		// Assume defaults
		winston.warn(`[errors/handle] Unable to retrieve plugin handlers for errors: ${err.message}`);
		return { cases };
	}
}
