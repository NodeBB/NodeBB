"use strict";

var async = require('async'),
	winston = require('winston'),
	templates = require('templates.js'),

	plugins = require('./plugins'),
	db = require('./database');


(function(Widgets) {
	Widgets.render = function(uid, area, callback) {
		if (!area.locations || !area.template) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		Widgets.getAreas(['global', area.template], area.locations, area.url, function(err, data) {
			if (err) {
				return callback(err);
			}

			var widgetsByLocation = {};

			async.map(area.locations, function(location, done) {
				widgetsByLocation[location] = data.global[location].concat(data[area.template][location]);

				if (!widgetsByLocation[location].length) {
					return done(null, {location: location, widgets: []});
				}

				async.map(widgetsByLocation[location], function(widget, next) {

					if (!widget || !widget.data || (!!widget.data['hide-registered'] && uid !== 0) || (!!widget.data['hide-guests'] && uid === 0)) {
						return next();
					}

					plugins.fireHook('filter:widget.render:' + widget.widget, {
						uid: uid,
						area: area,
						data: widget.data
					}, function(err, html) {
						if (err) {
							return next(err);
						}

						if (typeof html !== 'string') {
							html = '';
						}

						if (widget.data.container && widget.data.container.match('{body}')) {
							html = templates.parse(widget.data.container, {
								title: widget.data.title,
								body: html
							});
						}

						next(null, {html: html});
					});
				}, function(err, widgets) {
					done(err, {location: location, widgets: widgets.filter(Boolean)});
				});
			}, callback);
		});
	};

	Widgets.getAreas = function(templates, locations, url, callback) {
		var keys = templates.map(function(tpl) {
			return 'widgets:' + tpl;
		});
		db.getObjectsFields(keys, locations, function(err, data) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('filter:widgets.frontGetAreas', {data: data, templates: templates, locations: locations, url: url}, function(err, data) {
				if (err) {
					return callback(err);
				}
				var data = data.data;
				var returnData = {};
				templates.forEach(function(template, index) {
					returnData[template] = returnData[template] || {};
					locations.forEach(function(location) {
						if (data && data[index] && data[index][location]) {
							try {
								returnData[template][location] = JSON.parse(data[index][location]);
							} catch(err) {
								winston.error('can not parse widget data. template:  ' + template + ' location: ' + location);
								returnData[template][location] = [];
							}
						} else {
							returnData[template][location] = [];
						}
					});
				});
				callback(null, returnData);
			});
		});
	};

	Widgets.getArea = function(template, location, callback) {
		db.getObjectField('widgets:' + template, location, function(err, widgets) {
			if (err) {
				return callback(err);
			}
			if (!widgets) {
				return callback(null, []);
			}
			try {
				widgets = JSON.parse(widgets);
			} catch(err) {
				return callback(err);
			}

			callback(null, widgets);
		});
	};

	Widgets.setArea = function(area, callback) {
		if (!area.location || !area.template) {
			return callback(new Error('Missing location and template data'));
		}

		db.setObjectField('widgets:' + area.template, area.location, JSON.stringify(area.widgets), callback);
	};

	Widgets.reset = function(callback) {
		var defaultAreas = [
			{ name: 'Draft Zone', template: 'global', location: 'drafts' }
		];

		plugins.fireHook('filter:widgets.getAreas', defaultAreas, function(err, areas) {
			if (err) {
				return callback(err);
			}
			var drafts = [];

			async.each(areas, function(area, next) {
				Widgets.getArea(area.template, area.location, function(err, areaData) {
					if (err) {
						return next(err);
					}

					drafts = drafts.concat(areaData);
					area.widgets = [];
					Widgets.setArea(area, next);
				});
			}, function(err) {
				if (err) {
					return callback(err);
				}
				Widgets.setArea({
					template: 'global',
					location: 'drafts',
					widgets: drafts
				}, callback);
			});
		});
	};

}(exports));
