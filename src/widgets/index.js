"use strict";

var async = require('async');
var winston = require('winston');
var templates = require('templates.js');

var plugins = require('../plugins');
var translator = require('../../public/src/modules/translator');
var db = require('../database');

var widgets = {};

widgets.render = function(uid, area, req, res, callback) {
	if (!area.locations || !area.template) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	widgets.getAreas(['global', area.template], area.locations, function(err, data) {
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
				if (!widget || !widget.data ||
					(!!widget.data['hide-registered'] && uid !== 0) ||
					(!!widget.data['hide-guests'] && uid === 0) ||
					(!!widget.data['hide-mobile'] && area.isMobile)) {
					return next();
				}

				plugins.fireHook('filter:widget.render:' + widget.widget, {
					uid: uid,
					area: area,
					data: widget.data,
					req: req,
					res: res
				}, function(err, html) {
					if (err) {
						return next(err);
					}

					if (typeof html !== 'string') {
						html = '';
					}

					if (widget.data.container && widget.data.container.match('{body}')) {
						translator.translate(widget.data.title, function(title) {
							html = templates.parse(widget.data.container, {
								title: title,
								body: html
							});

							next(null, {html: html});
						});
					} else {
						next(null, {html: html});
					}
				});
			}, function(err, result) {
				done(err, {location: location, widgets: result.filter(Boolean)});
			});
		}, callback);
	});
};

widgets.getAreas = function(templates, locations, callback) {
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
};

widgets.getArea = function(template, location, callback) {
	db.getObjectField('widgets:' + template, location, function(err, result) {
		if (err) {
			return callback(err);
		}
		if (!result) {
			return callback(null, []);
		}
		try {
			result = JSON.parse(result);
		} catch(err) {
			return callback(err);
		}

		callback(null, result);
	});
};

widgets.setArea = function(area, callback) {
	if (!area.location || !area.template) {
		return callback(new Error('Missing location and template data'));
	}

	db.setObjectField('widgets:' + area.template, area.location, JSON.stringify(area.widgets), callback);
};

widgets.reset = function(callback) {
	var defaultAreas = [
		{ name: 'Draft Zone', template: 'global', location: 'header' },
		{ name: 'Draft Zone', template: 'global', location: 'footer' },
		{ name: 'Draft Zone', template: 'global', location: 'sidebar' }
	];

	plugins.fireHook('filter:widgets.getAreas', defaultAreas, function(err, areas) {
		if (err) {
			return callback(err);
		}
		var drafts = [];

		async.each(areas, function(area, next) {
			widgets.getArea(area.template, area.location, function(err, areaData) {
				if (err) {
					return next(err);
				}

				drafts = drafts.concat(areaData);
				area.widgets = [];
				widgets.setArea(area, next);
			});
		}, function(err) {
			if (err) {
				return callback(err);
			}
			widgets.setArea({
				template: 'global',
				location: 'drafts',
				widgets: drafts
			}, callback);
		});
	});
};

module.exports = widgets;
