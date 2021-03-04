'use strict';

const privileges = require('../../privileges');
const categories = require('../../categories');
const api = require('../../api');

const helpers = require('../helpers');

const Categories = module.exports;

const hasAdminPrivilege = async (uid) => {
	const ok = await privileges.admin.can(`admin:categories`, uid);
	if (!ok) {
		throw new Error('[[error:no-privileges]]');
	}
};

Categories.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.categories.get(req, req.params));
};

Categories.create = async (req, res) => {
	await hasAdminPrivilege(req.uid);

	const response = await api.categories.create(req, req.body);
	helpers.formatApiResponse(200, res, response);
};

Categories.update = async (req, res) => {
	await hasAdminPrivilege(req.uid);

	const payload = {};
	payload[req.params.cid] = req.body;
	await api.categories.update(req, payload);
	const categoryObjs = await categories.getCategories([req.params.cid]);
	helpers.formatApiResponse(200, res, categoryObjs[0]);
};

Categories.delete = async (req, res) => {
	await hasAdminPrivilege(req.uid);

	await api.categories.delete(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res);
};

Categories.getPrivileges = async (req, res) => {
	if (!await privileges.admin.can('admin:privileges', req.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	const privilegeSet = await api.categories.getPrivileges(req, req.params.cid);
	helpers.formatApiResponse(200, res, privilegeSet);
};

Categories.setPrivilege = async (req, res) => {
	if (!await privileges.admin.can('admin:privileges', req.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	await api.categories.setPrivilege(req, {
		...req.params,
		member: req.body.member,
		set: req.method === 'PUT',
	});

	const privilegeSet = await api.categories.getPrivileges(req, req.params.cid);
	helpers.formatApiResponse(200, res, privilegeSet);
};
