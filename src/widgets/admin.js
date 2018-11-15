'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var nconf = require('nconf');
var benchpress = require('benchpressjs');

var plugins = require('../plugins');
var groups = require('../groups');

var admin = module.exports;

admin.get = function (callback) {
	async.parallel({
		areas: admin.getAreas,
		availableWidgets: getAvailableWidgets,
	}, function (err, widgetData) {
		if (err) {
			return callback(err);
		}

		callback(false, {
			templates: buildTemplatesFromAreas(widgetData.areas),
			areas: widgetData.areas,
			availableWidgets: widgetData.availableWidgets,
		});
	});
};

admin.getAreas = function (callback) {
	async.waterfall([
		function (next) {
			var defaultAreas = [
				{ name: 'Global Sidebar', template: 'global', location: 'sidebar' },
				{ name: 'Global Header', template: 'global', location: 'header' },
				{ name: 'Global Footer', template: 'global', location: 'footer' },

				{ name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left' },
				{ name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right' },
			];

			plugins.fireHook('filter:widgets.getAreas', defaultAreas, next);
		},
		function (areas, next) {
			areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });
			async.map(areas, function (area, next) {
				require('./index').getArea(area.template, area.location, function (err, areaData) {
					area.data = areaData;
					next(err, area);
				});
			}, next);
		},
	], callback);
};

function getAvailableWidgets(callback) {
	async.parallel({
		availableWidgets: function (next) {
			plugins.fireHook('filter:widgets.getWidgets', [], next);
		},
		adminTemplate: function (next) {
			renderAdminTemplate(next);
		},
	}, function (err, results) {
		if (err) {
			return callback(err);
		}
		results.availableWidgets.forEach(function (w) {
			w.content += results.adminTemplate;
		});
		callback(null, results.availableWidgets);
	});
}

function renderAdminTemplate(callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				source: async.apply(getSource),
				groups: async.apply(groups.getNonPrivilegeGroups, 'groups:createtime', 0, -1),
			}, next);
		},
		function (results, next) {
			results.groups.sort((a, b) => b.system - a.system);
			benchpress.compileParse(results.source, { groups: results.groups }, next);
		},
	], callback);
}

function getSource(callback) {
	fs.readFile(path.resolve(nconf.get('views_dir'), 'admin/partials/widget-settings.tpl'), 'utf8', callback);
}

function buildTemplatesFromAreas(areas) {
	const templates = [];
	var list = {};
	var index = 0;

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
