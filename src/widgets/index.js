'use strict';

const winston = require('winston');
const _ = require('lodash');
const Benchpress = require('benchpressjs');

const plugins = require('../plugins');
const groups = require('../groups');
const translator = require('../translator');
const db = require('../database');
const apiController = require('../controllers/api');
const meta = require('../meta');

const widgets = module.exports;

widgets.render = async function (uid, options) {
	if (!options.template) {
		throw new Error('[[error:invalid-data]]');
	}
	const data = await widgets.getWidgetDataForTemplates(['global', options.template]);
	delete data.global.drafts;

	const locations = _.uniq(Object.keys(data.global).concat(Object.keys(data[options.template])));

	const widgetData = await Promise.all(locations.map(location => renderLocation(location, data, uid, options)));

	const returnData = {};
	locations.forEach((location, i) => {
		if (Array.isArray(widgetData[i]) && widgetData[i].length) {
			returnData[location] = widgetData[i].filter(Boolean);
		}
	});

	return returnData;
};

async function renderLocation(location, data, uid, options) {
	const widgetsAtLocation = (data[options.template][location] || []).concat(data.global[location] || []);

	if (!widgetsAtLocation.length) {
		return [];
	}

	const renderedWidgets = await Promise.all(widgetsAtLocation.map(widget => renderWidget(widget, uid, options)));
	return renderedWidgets;
}

async function renderWidget(widget, uid, options) {
	if (!widget || !widget.data || (!!widget.data['hide-mobile'] && options.req.useragent.isMobile)) {
		return;
	}

	const isVisible = await checkVisibility(widget, uid);
	if (!isVisible) {
		return;
	}

	let config = options.res.locals.config || {};
	if (options.res.locals.isAPI) {
		config = await apiController.loadConfig(options.req);
	}

	const userLang = config.userLang || meta.config.defaultLang || 'en-GB';
	const templateData = _.assign({ }, options.templateData, { config: config });
	const data = await plugins.hooks.fire(`filter:widget.render:${widget.widget}`, {
		uid: uid,
		area: options,
		templateData: templateData,
		data: widget.data,
		req: options.req,
		res: options.res,
	});

	if (!data) {
		return;
	}

	let html = data.html;

	if (widget.data.container && widget.data.container.match('{body}')) {
		html = await Benchpress.compileRender(widget.data.container, {
			title: widget.data.title,
			body: html,
			template: data.templateData && data.templateData.template,
		});
	}

	if (html) {
		html = await translator.translate(html, userLang);
	}

	return { html };
}

async function checkVisibility(widget, uid) {
	let isVisible = true;
	let isHidden = false;
	if (widget.data.groups.length) {
		isVisible = await groups.isMemberOfAny(uid, widget.data.groups);
	}
	if (widget.data.groupsHideFrom.length) {
		isHidden = await groups.isMemberOfAny(uid, widget.data.groupsHideFrom);
	}
	return isVisible && !isHidden;
}

widgets.getWidgetDataForTemplates = async function (templates) {
	const keys = templates.map(tpl => `widgets:${tpl}`);
	const data = await db.getObjects(keys);

	const returnData = {};

	templates.forEach((template, index) => {
		returnData[template] = returnData[template] || {};

		const templateWidgetData = data[index] || {};
		const locations = Object.keys(templateWidgetData);

		locations.forEach((location) => {
			if (templateWidgetData && templateWidgetData[location]) {
				try {
					returnData[template][location] = parseWidgetData(templateWidgetData[location]);
				} catch (err) {
					winston.error(`can not parse widget data. template:  ${template} location: ${location}`);
					returnData[template][location] = [];
				}
			} else {
				returnData[template][location] = [];
			}
		});
	});

	return returnData;
};

widgets.getArea = async function (template, location) {
	const result = await db.getObjectField(`widgets:${template}`, location);
	if (!result) {
		return [];
	}
	return parseWidgetData(result);
};

function parseWidgetData(data) {
	const widgets = JSON.parse(data);
	widgets.forEach((widget) => {
		if (widget) {
			widget.data.groups = widget.data.groups || [];
			if (widget.data.groups && !Array.isArray(widget.data.groups)) {
				widget.data.groups = [widget.data.groups];
			}

			widget.data.groupsHideFrom = widget.data.groupsHideFrom || [];
			if (widget.data.groupsHideFrom && !Array.isArray(widget.data.groupsHideFrom)) {
				widget.data.groupsHideFrom = [widget.data.groupsHideFrom];
			}
		}
	});
	return widgets;
}

widgets.setArea = async function (area) {
	if (!area.location || !area.template) {
		throw new Error('Missing location and template data');
	}

	await db.setObjectField(`widgets:${area.template}`, area.location, JSON.stringify(area.widgets));
};

widgets.reset = async function () {
	const defaultAreas = [
		{ name: 'Draft Zone', template: 'global', location: 'header' },
		{ name: 'Draft Zone', template: 'global', location: 'footer' },
		{ name: 'Draft Zone', template: 'global', location: 'sidebar' },
	];

	const [areas, drafts] = await Promise.all([
		plugins.hooks.fire('filter:widgets.getAreas', defaultAreas),
		widgets.getArea('global', 'drafts'),
	]);

	let saveDrafts = drafts || [];
	for (const area of areas) {
		/* eslint-disable no-await-in-loop */
		const areaData = await widgets.getArea(area.template, area.location);
		saveDrafts = saveDrafts.concat(areaData);
		area.widgets = [];
		await widgets.setArea(area);
	}

	await widgets.setArea({
		template: 'global',
		location: 'drafts',
		widgets: saveDrafts,
	});
};

widgets.resetTemplate = async function (template) {
	let toBeDrafted = [];
	const area = await db.getObject(`widgets:${template}.tpl`);
	for (var location in area) {
		if (area.hasOwnProperty(location)) {
			toBeDrafted = toBeDrafted.concat(JSON.parse(area[location]));
		}
	}
	await db.delete(`widgets:${template}.tpl`);
	let draftWidgets = await db.getObjectField('widgets:global', 'drafts');
	draftWidgets = JSON.parse(draftWidgets).concat(toBeDrafted);
	await db.setObjectField('widgets:global', 'drafts', JSON.stringify(draftWidgets));
};

widgets.resetTemplates = async function (templates) {
	for (const template of templates) {
		/* eslint-disable no-await-in-loop */
		await widgets.resetTemplate(template);
	}
};

require('../promisify')(widgets);
