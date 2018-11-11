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
		areas: function (next) {
			var defaultAreas = [
				{ name: 'Global Sidebar', template: 'global', location: 'sidebar' },
				{ name: 'Global Header', template: 'global', location: 'header' },
				{ name: 'Global Footer', template: 'global', location: 'footer' },

				{ name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left' },
				{ name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right' },
			];

			plugins.fireHook('filter:widgets.getAreas', defaultAreas, next);
		},
		widgets: function (next) {
			plugins.fireHook('filter:widgets.getWidgets', [], next);
		},
		adminTemplate: function (next) {
			renderAdminTemplate(next);
		},
	}, function (err, widgetData) {
		if (err) {
			return callback(err);
		}
		widgetData.areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });

		async.each(widgetData.areas, function (area, next) {
			require('./index').getArea(area.template, area.location, function (err, areaData) {
				area.data = areaData;
				next(err);
			});
		}, function (err) {
			if (err) {
				return callback(err);
			}

			widgetData.widgets.forEach(function (w) {
				w.content += widgetData.adminTemplate;
			});

			var templates = [];
			var list = {};
			var index = 0;

			widgetData.areas.forEach(function (area) {
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

			callback(false, {
				templates: templates,
				areas: widgetData.areas,
				availableWidgets: widgetData.widgets,
			});
		});
	});
};

function renderAdminTemplate(callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				source: async.apply(fs.readFile, path.resolve(nconf.get('views_dir'), 'admin/partials/widget-settings.tpl'), 'utf8'),
				groups: async.apply(groups.getNonPrivilegeGroups, 'groups:createtime', 0, -1),
			}, next);
		},
		function (results, next) {
			results.groups.sort((a, b) => b.system - a.system);
			benchpress.compileParse(results.source, { groups: results.groups }, next);
		},
	], callback);
}
