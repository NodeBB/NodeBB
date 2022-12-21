'use strict';

const webserver = require('../webserver');
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

	const areas = await plugins.hooks.fire('filter:widgets.getAreas', defaultAreas);

	areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });
	const areaData = await Promise.all(areas.map(area => index.getArea(area.template, area.location)));
	areas.forEach((area, i) => {
		area.data = areaData[i];
	});
	return areas;
};

async function getAvailableWidgets() {
	const [availableWidgets, adminTemplate] = await Promise.all([
		plugins.hooks.fire('filter:widgets.getWidgets', []),
		renderAdminTemplate(),
	]);
	availableWidgets.forEach((w) => {
		w.content += adminTemplate;
	});
	return availableWidgets;
}

async function renderAdminTemplate() {
	const groupsData = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
	groupsData.sort((a, b) => b.system - a.system);
	return await webserver.app.renderAsync('admin/partials/widget-settings', { groups: groupsData });
}

function buildTemplatesFromAreas(areas) {
	const templates = [];
	const list = {};
	let index = 0;

	areas.forEach((area) => {
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
