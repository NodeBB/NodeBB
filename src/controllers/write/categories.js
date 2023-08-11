'use strict';

const categories = require('../../categories');
const api = require('../../api');

const helpers = require('../helpers');

const Categories = module.exports;

Categories.get = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.categories.get(req, req.params));
};

Categories.create = async (req, res) => {
	const response = await api.categories.create(req, req.body);
	helpers.formatApiResponse(200, res, response);
};

Categories.update = async (req, res) => {
	await api.categories.update(req, {
		cid: req.params.cid,
		values: req.body,
	});

	const categoryObjs = await categories.getCategories([req.params.cid]);
	helpers.formatApiResponse(200, res, categoryObjs[0]);
};

Categories.delete = async (req, res) => {
	await api.categories.delete(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res);
};

Categories.getPrivileges = async (req, res) => {
	const privilegeSet = await api.categories.getPrivileges(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res, privilegeSet);
};

Categories.setPrivilege = async (req, res) => {
	const { cid, privilege } = req.params;

	await api.categories.setPrivilege(req, {
		cid,
		privilege,
		member: req.body.member,
		set: req.method === 'PUT',
	});

	const privilegeSet = await api.categories.getPrivileges(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res, privilegeSet);
};

Categories.setModerator = async (req, res) => {
	await api.categories.setModerator(req, {
		cid: req.params.cid,
		member: req.params.uid,
		set: req.method === 'PUT',
	});

	const privilegeSet = await api.categories.getPrivileges(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res, privilegeSet);
};
