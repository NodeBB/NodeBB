'use strict';

module.exports = function (app, middleware, controllers) {
	app.use('/.well-known/change-password', (req, res) => {
		res.redirect('/me/edit/password');
	});

	app.get('/.well-known/webfinger', controllers['well-known'].webfinger);
};
