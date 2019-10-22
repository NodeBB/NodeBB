'use strict';

const nconf = require('nconf');
const winston = require('winston');
const validator = require('validator');

const meta = require('../meta');
const plugins = require('../plugins');

exports.handle404 = function handle404(req, res) {
	const relativePath = nconf.get('relative_path');
	const isClientScript = new RegExp('^' + relativePath + '\\/assets\\/src\\/.+\\.js(\\?v=\\w+)?$');

	if (plugins.hasListeners('action:meta.override404')) {
		return plugins.fireHook('action:meta.override404', {
			req: req,
			res: res,
			error: {},
		});
	}

	if (isClientScript.test(req.url)) {
		res.type('text/javascript').status(200).send('');
	} else if (req.path.startsWith(relativePath + '/assets/uploads') || (req.get('accept') && !req.get('accept').includes('text/html')) || req.path === '/favicon.ico') {
		meta.errors.log404(req.path || '');
		res.sendStatus(404);
	} else if (req.accepts('html')) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		meta.errors.log404(req.path.replace(/^\/api/, '') || '');
		exports.send404(req, res);
	} else {
		res.status(404).type('txt').send('Not found');
	}
};

exports.send404 = function (req, res) {
	res.status(404);
	const path = String(req.path || '');
	if (res.locals.isAPI) {
		return res.json({ path: validator.escape(path.replace(/^\/api/, '')), title: '[[global:404.title]]' });
	}
	const middleware = require('../middleware');
	middleware.buildHeader(req, res, function () {
		res.render('404', { path: validator.escape(path), title: '[[global:404.title]]' });
	});
};
