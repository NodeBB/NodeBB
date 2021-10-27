'use strict';

const express = require('express');

const uploadsController = require('../controllers/uploads');
const helpers = require('./helpers');

module.exports = function (app, middleware, controllers) {
	const router = express.Router();
	app.use('/api', router);

	router.get('/config', middleware.applyCSRF, middleware.authenticateRequest, helpers.tryRoute(controllers.api.getConfig));

	router.get('/self', helpers.tryRoute(controllers.user.getCurrentUser));
	router.get('/user/uid/:uid', middleware.canViewUsers, helpers.tryRoute(controllers.user.getUserByUID));
	router.get('/user/username/:username', middleware.canViewUsers, helpers.tryRoute(controllers.user.getUserByUsername));
	router.get('/user/email/:email', middleware.canViewUsers, helpers.tryRoute(controllers.user.getUserByEmail));

	router.get('/user/uid/:userslug/export/posts', middleware.authenticateRequest, middleware.ensureLoggedIn, middleware.checkAccountPermissions, middleware.exposeUid, helpers.tryRoute(controllers.user.exportPosts));
	router.get('/user/uid/:userslug/export/uploads', middleware.authenticateRequest, middleware.ensureLoggedIn, middleware.checkAccountPermissions, middleware.exposeUid, helpers.tryRoute(controllers.user.exportUploads));
	router.get('/user/uid/:userslug/export/profile', middleware.authenticateRequest, middleware.ensureLoggedIn, middleware.checkAccountPermissions, middleware.exposeUid, helpers.tryRoute(controllers.user.exportProfile));

	router.get('/categories/:cid/moderators', helpers.tryRoute(controllers.api.getModerators));
	router.get('/recent/posts/:term?', helpers.tryRoute(controllers.posts.getRecentPosts));
	router.get('/unread/total', middleware.authenticateRequest, middleware.ensureLoggedIn, helpers.tryRoute(controllers.unread.unreadTotal));
	router.get('/topic/teaser/:topic_id', helpers.tryRoute(controllers.topics.teaser));
	router.get('/topic/pagination/:topic_id', helpers.tryRoute(controllers.topics.pagination));

	const multipart = require('connect-multiparty');
	const multipartMiddleware = multipart();
	const middlewares = [
		middleware.maintenanceMode,
		multipartMiddleware,
		middleware.validateFiles,
		middleware.uploads.ratelimit,
		middleware.applyCSRF,
	];

	router.post('/post/upload', middlewares, helpers.tryRoute(uploadsController.uploadPost));
	router.post('/user/:userslug/uploadpicture',
		middlewares.concat([
			middleware.exposeUid,
			middleware.authenticateRequest,
			middleware.ensureLoggedIn,
			middleware.canViewUsers,
			middleware.checkAccountPermissions,
		]),
		helpers.tryRoute(controllers.accounts.edit.uploadPicture));
};
