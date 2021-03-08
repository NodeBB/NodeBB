'use strict';

const express = require('express');

const uploadsController = require('../controllers/uploads');

module.exports = function (app, middleware, controllers) {
	const router = express.Router();
	app.use('/api', router);

	router.get('/config', middleware.applyCSRF, middleware.authenticateRequest, controllers.api.getConfig);

	router.get('/self', controllers.user.getCurrentUser);
	router.get('/user/uid/:uid', middleware.canViewUsers, controllers.user.getUserByUID);
	router.get('/user/username/:username', middleware.canViewUsers, controllers.user.getUserByUsername);
	router.get('/user/email/:email', middleware.canViewUsers, controllers.user.getUserByEmail);

	router.get('/user/uid/:userslug/export/posts', middleware.checkAccountPermissions, middleware.exposeUid, controllers.user.exportPosts);
	router.get('/user/uid/:userslug/export/uploads', middleware.checkAccountPermissions, middleware.exposeUid, controllers.user.exportUploads);
	router.get('/user/uid/:userslug/export/profile', middleware.checkAccountPermissions, middleware.exposeUid, controllers.user.exportProfile);

	router.get('/categories/:cid/moderators', controllers.api.getModerators);
	router.get('/recent/posts/:term?', controllers.posts.getRecentPosts);
	router.get('/unread/total', middleware.authenticateRequest, middleware.ensureLoggedIn, controllers.unread.unreadTotal);
	router.get('/topic/teaser/:topic_id', controllers.topics.teaser);
	router.get('/topic/pagination/:topic_id', controllers.topics.pagination);

	const multipart = require('connect-multiparty');
	const multipartMiddleware = multipart();
	const middlewares = [middleware.maintenanceMode, multipartMiddleware, middleware.validateFiles, middleware.applyCSRF];
	router.post('/post/upload', middlewares, uploadsController.uploadPost);

	router.post('/user/:userslug/uploadpicture', middlewares.concat([middleware.exposeUid, middleware.authenticateRequest, middleware.ensureLoggedIn, middleware.canViewUsers, middleware.checkAccountPermissions]), controllers.accounts.edit.uploadPicture);
};
