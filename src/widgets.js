"use strict";

var async = require('async'),
	winston = require('winston'),
	plugins = require('./plugins'),
	db = require('./database'),
	templates = require('./../public/src/templates');


(function(Widgets) {

	Widgets.render = function(uid, area, callback) {
		if (!area.location || !area.template) {
			callback({
				error: 'Missing location and template data'
			});
		}

		var rendered = [];

		async.parallel({
			global: function(next) {
				Widgets.getArea('global', area.location, next);
			},
			local: function(next) {
				Widgets.getArea(area.template, area.location, next);
			}
		}, function(err, data) {
			var widgets = data.global.concat(data.local);

			async.eachSeries(widgets, function(widget, next) {
				if (!!widget.data['registered-only'] && uid === 0) {
					return next();
				}

				plugins.fireHook('filter:widget.render:' + widget.widget, {
					uid: uid,
					area: area,
					data: widget.data
				}, function(err, html){
					if (widget.data.container && widget.data.container.match('{body}')) {
						html = templates.parse(widget.data.container, {
							title: widget.data.title,
							body: html
						});
					}
					
					rendered.push({
						html: html
					});

					next(err);
				});
			}, function(err) {
				callback(err, rendered);
			});
		});
	};

	Widgets.getArea = function(template, location, callback) {
		db.getObjectField('widgets:' + template, location, function(err, widgets) {
			if (!widgets) {
				return callback(err, []);
			}
			callback(err, JSON.parse(widgets));
		});
	};

	Widgets.setArea = function(area, callback) {
		if (!area.location || !area.template) {
			callback({
				error: 'Missing location and template data'
			});
		}
		
		db.setObjectField('widgets:' + area.template, area.location, JSON.stringify(area.widgets), function(err) {
			callback(err);
		});
	};

	Widgets.reset = function(callback) {
		var defaultAreas = [
			{ name: 'Draft Zone', template: 'global', location: 'drafts' }
		];

		plugins.fireHook('filter:widgets.getAreas', defaultAreas, function(err, areas) {
			var drafts = [];

			async.each(areas, function(area, next) {
				Widgets.getArea(area.template, area.location, function(err, areaData) {
					drafts = drafts.concat(areaData);
					area.widgets = [];
					Widgets.setArea(area, next);
				});
			}, function(err) {
				Widgets.setArea({
					template: 'global',
					location: 'drafts',
					widgets: drafts
				}, callback);
			});
		});
	};

}(exports));
