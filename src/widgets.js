"use strict";

var async = require('async'),
	winston = require('winston'),
	templates = require('templates.js'),

	plugins = require('./plugins'),
	db = require('./database');


(function(Widgets) {

	Widgets.render = function(uid, area, callback) {
		if (!area.locations || !area.template) {
			callback({
				error: 'Missing location and template data'
			});
		}

		Widgets.getAreas(['global', area.template], area.locations, function(err, data) {

			var widgetsByLocation = {};

			async.map(area.locations, function(location, done) {
				widgetsByLocation[location] = data.global[location].concat(data[area.template][location]);

				if (!widgetsByLocation[location].length) {
					return done(null, {location: location, widgets: []});
				}

				async.map(widgetsByLocation[location], function(widget, next) {

					if (!widget || !widget.data || (!!widget.data['registered-only'] && uid === 0)) {
						return next();
					}

					plugins.fireHook('filter:widget.render:' + widget.widget, {
						uid: uid,
						area: area,
						data: widget.data
					}, function(err, html) {
						if (widget.data.container && widget.data.container.match('{body}')) {
							html = templates.parse(widget.data.container, {
								title: widget.data.title,
								body: html
							});
						}

						next(err, {html: html});
					});
				}, function(err, widgets) {
					done(err, {location: location, widgets: widgets.filter(Boolean)});
				});
			}, callback);
		});
	};

	Widgets.getAreas = function(templates, locations, callback) {
		var keys = templates.map(function(tpl) {
			return 'widgets:' + tpl;
		});
		db.getObjectsFields(keys, locations, function(err, data) {
			if (err) {
				return callback(err);
			}

			var returnData = {};

			templates.forEach(function(template, index) {
				returnData[template] = returnData[template] || {};
				locations.forEach(function(location) {
					if (data && data[index] && data[index][location]) {
						returnData[template][location] = JSON.parse(data[index][location]);
					} else {
						returnData[template][location] = [];
					}
				});
			});

			callback(null, returnData);
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
