"use strict";


var async = require('async'),
	plugins = require('../plugins');

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
			for (var w in widgetData.widgets) {
				if (widgetData.widgets.hasOwnProperty(w)) {
					// if this gets anymore complicated, it needs to be a template
					widgetData.widgets[w].content += "<br /><label>Title:</label><input type=\"text\" class=\"form-control\" name=\"title\" placeholder=\"Title (only shown on some containers)\" /><br /><label>Container:</label><textarea rows=\"4\" class=\"form-control container-html\" name=\"container\" placeholder=\"Drag and drop a container or enter HTML here.\"></textarea><div class=\"checkbox\"><label><input name=\"hide-guests\" type=\"checkbox\"> Hide from anonymous users?</label></div><div class=\"checkbox\"><label><input name=\"hide-registered\" type=\"checkbox\"> Hide from registered users?</input></label></div>";
				}
			}

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