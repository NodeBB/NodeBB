'use strict';

const fs = require('fs');

const path = require('path');
const nconf = require('nconf');
const benchpress = require('benchpressjs');

const plugins = require('../plugins');
const groups = require('../groups');
const index = require('./index');

const admin = module.exports;

admin.get = async function () {
	const [areas, availableWidgets] = await Promise.all([
		admin.getAreas(),
		getAvailableWidgets(),
	]);

	return {
		templates: buildTemplatesFromAreas(areas),
		areas: areas,
		availableWidgets: availableWidgets,
	};
};

admin.getAreas = async function () {
	const defaultAreas = [
		{ name: 'Global Sidebar', template: 'global', location: 'sidebar' },
		{ name: 'Global Header', template: 'global', location: 'header' },
		{ name: 'Global Footer', template: 'global', location: 'footer' },

		{ name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left' },
		{ name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right' },
	];

	const areas = await plugins.fireHook('filter:widgets.getAreas', defaultAreas);

	areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });
	const areaData = await Promise.all(areas.map(area => index.getArea(area.template, area.location)));
	areas.forEach((area, i) => {
		area.data = areaData[i];
	});
	return areas;
};

async function getAvailableWidgets() {
	const [availableWidgets, adminTemplate] = await Promise.all([
		plugins.fireHook('filter:widgets.getWidgets', []),
		renderAdminTemplate(),
	]);
	availableWidgets.forEach(function (w) {
		w.content += adminTemplate;
	});
	return availableWidgets;
}

async function renderAdminTemplate() {
	const [source, groupsData] = await Promise.all([
		getSource(),
		groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
	]);
	groupsData.sort((a, b) => b.system - a.system);
	return await benchpress.compileRender(source, { groups: groupsData });
}

async function getSource() {
	return await fs.promises.readFile(path.resolve(nconf.get('views_dir'), 'admin/partials/widget-settings.tpl'), 'utf8');
}

function buildTemplatesFromAreas(areas) {
	const templates = [];
	const list = {};
	let index = 0;

	areas.forEach(function (area) {
		if (typeof list[area.template] === 'undefined') {
			list[area.template] = index;
			templates.push({
				template: area.template,
				areas: [],
			});

			index += 1;
		}

		templates[list[area.template]].areas.push({
			name: area.name,
			location: area.location,
		});
	});
	return templates;
}

require('../promisify')(admin);
