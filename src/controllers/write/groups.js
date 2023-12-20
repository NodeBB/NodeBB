'use strict';

const api = require('../../api');

const helpers = require('../helpers');

const Groups = module.exports;

Groups.list = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.groups.list(req, { ...req.query }));
};

Groups.exists = async (req, res) => {
	helpers.formatApiResponse(200, res);
};

Groups.create = async (req, res) => {
	const groupObj = await api.groups.create(req, req.body);
	helpers.formatApiResponse(200, res, groupObj);
};

Groups.update = async (req, res) => {
	const groupObj = await api.groups.update(req, {
		...req.body,
		slug: req.params.slug,
	});
	helpers.formatApiResponse(200, res, groupObj);
};

Groups.delete = async (req, res) => {
	await api.groups.delete(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.listMembers = async (req, res) => {
	const { slug } = req.params;
	helpers.formatApiResponse(200, res, await api.groups.listMembers(req, { ...req.query, slug }));
};

Groups.join = async (req, res) => {
	await api.groups.join(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.leave = async (req, res) => {
	await api.groups.leave(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.grant = async (req, res) => {
	await api.groups.grant(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.rescind = async (req, res) => {
	await api.groups.rescind(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.getPending = async (req, res) => {
	const pending = await api.groups.getPending(req, req.params);
	helpers.formatApiResponse(200, res, { pending });
};

Groups.accept = async (req, res) => {
	await api.groups.accept(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.reject = async (req, res) => {
	await api.groups.reject(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.getInvites = async (req, res) => {
	const invites = await api.groups.getInvites(req, req.params);
	helpers.formatApiResponse(200, res, { invites });
};

Groups.issueInvite = async (req, res) => {
	await api.groups.issueInvite(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.acceptInvite = async (req, res) => {
	await api.groups.acceptInvite(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.rejectInvite = async (req, res) => {
	await api.groups.rejectInvite(req, req.params);
	helpers.formatApiResponse(200, res);
};
