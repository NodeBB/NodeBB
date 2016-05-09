"use strict";

var fs = require('fs');
var path = require('path');
var async = require('async');
var plugins = require('../plugins');

var admin = {};

admin.get = function(callback) {
	async.parallel({
		areas: function(next) {
			var defaultAreas = [
				{ name: 'Global Sidebar', template: 'global', location: 'sidebar' },
				{ name: 'Global Header', template: 'global', location: 'header' },
				{ name: 'Global Footer', template: 'global', location: 'footer' },

				{ name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left'},
				{ name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right'}
			];

			plugins.fireHook('filter:widgets.getAreas', defaultAreas, next);
		},
		widgets: function(next) {
			plugins.fireHook('filter:widgets.getWidgets', [], next);
		},
		adminTemplate: function(next) {
			fs.readFile(path.resolve(__dirname, '../../public/templates/admin/partials/widget-settings.tpl'), 'utf8', next);
		}
	}, function(err, widgetData) {
		if (err) {
			return callback(err);
		}
		widgetData.areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });

		async.each(widgetData.areas, function(area, next) {
			require('./index').getArea(area.template, area.location, function(err, areaData) {
				area.data = areaData;
				next(err);
			});
		}, function(err) {
			if (err) {
				return callback(err);
			}

			widgetData.widgets.forEach(function(w) {
				w.content += widgetData.adminTemplate;
			});

			var templates = [],
				list = {}, index = 0;

			widgetData.areas.forEach(function(area) {
				if (typeof list[area.template] === 'undefined') {
					list[area.template] = index;
					templates.push({
						template: area.template,
						areas: []
					});

					index++;
				}

				templates[list[area.template]].areas.push({
					name: area.name,
					location: area.location
				});
			});

			callback(false, {
				templates: templates,
				areas: widgetData.areas,
				widgets: widgetData.widgets
			});
		});
	});
};

module.exports = admin;