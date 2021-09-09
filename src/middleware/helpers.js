'use strict';

const helpers = module.exports;

helpers.try = function (middleware) {
	if (middleware && middleware.constructor && middleware.constructor.name === 'AsyncFunction') {
		return async function (req, res, next) {
			try {
				await middleware(req, res, next);
			} catch (err) {
				next(err);
			}
		};
	}
	return function (req, res, next) {
		try {
			middleware(req, res, next);
		} catch (err) {
			next(err);
		}
	};
};
