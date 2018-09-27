'use strict';

var express = require('express');

var uploadsController = require('../controllers/uploads');

module.exports = function (app, middleware, controllers) {
	var router = express.Router();
	app.use('/api', router);

	router.get('/config', middleware.applyCSRF, controllers.api.getConfig);

	router.get('/me', middleware.checkGlobalPrivacySettings, controllers.user.getCurrentUser);
	router.get('/user/uid/:uid', middleware.checkGlobalPrivacySettings, controllers.user.getUserByUID);
	router.get('/user/username/:username', middleware.checkGlobalPrivacySettings, controllers.user.getUserByUsername);
	router.get('/user/email/:email', middleware.checkGlobalPrivacySettings, controllers.user.getUserByEmail);

	router.get('/user/uid/:userslug/export/posts', middleware.checkAccountPermissions, middleware.exposeUid, controllers.user.exportPosts);
	router.get('/user/uid/:userslug/export/uploads', middleware.checkAccountPermissions, middleware.exposeUid, controllers.user.exportUploads);
	router.get('/user/uid/:userslug/export/profile', middleware.checkAccountPermissions, middleware.exposeUid, controllers.user.exportProfile);

	router.get('/:type/pid/:id', controllers.api.getObject);
	router.get('/:type/tid/:id', controllers.api.getObject);
	router.get('/:type/cid/:id', controllers.api.getObject);

	router.get('/categories/:cid/moderators', controllers.api.getModerators);
	router.get('/recent/posts/:term?', controllers.posts.getRecentPosts);
	router.get('/unread/total', middleware.authenticate, controllers.unread.unreadTotal);
	router.get('/topic/teaser/:topic_id', controllers.topics.teaser);
	router.get('/topic/pagination/:topic_id', controllers.topics.pagination);

	var multipart = require('connect-multiparty');
	var multipartMiddleware = multipart();
	var middlewares = [middleware.maintenanceMode, multipartMiddleware, middleware.validateFiles, middleware.applyCSRF];
	router.post('/post/upload', middlewares, uploadsController.uploadPost);
	router.post('/topic/thumb/upload', middlewares, uploadsController.uploadThumb);
	router.post('/user/:userslug/uploadpicture', middlewares.concat([middleware.authenticate, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions]), controllers.accounts.edit.uploadPicture);

	router.post('/user/:userslug/uploadcover', middlewares.concat([middleware.authenticate, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions]), controllers.accounts.edit.uploadCoverPicture);
	router.post('/groups/uploadpicture', middlewares.concat([middleware.authenticate]), controllers.groups.uploadCover);
};

