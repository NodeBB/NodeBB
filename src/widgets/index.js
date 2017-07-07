'use strict';

var async = require('async');
var winston = require('winston');
var templates = require('templates.js');

var plugins = require('../plugins');
var translator = require('../translator');
var db = require('../database');

var widgets = module.exports;

widgets.render = function (uid, area, req, res, callback) {
	if (!area.locations || !area.template) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			widgets.getAreas(['global', area.template], area.locations, next);
		},
		function (data, next) {
			var widgetsByLocation = {};

			async.map(area.locations, function (location, done) {
				widgetsByLocation[location] = data.global[location].concat(data[area.template][location]);

				if (!widgetsByLocation[location].length) {
					return done(null, { location: location, widgets: [] });
				}

				async.map(widgetsByLocation[location], function (widget, next) {
					if (!widget || !widget.data ||
						(!!widget.data['hide-registered'] && uid !== 0) ||
						(!!widget.data['hide-guests'] && uid === 0) ||
						(!!widget.data['hide-mobile'] && area.isMobile)) {
						return next();
					}

					renderWidget(widget, uid, area, req, res, next);
				}, function (err, result) {
					done(err, { location: location, widgets: result.filter(Boolean) });
				});
			}, next);
		},
	], callback);
};

function renderWidget(widget, uid, area, req, res, callback) {
	async.waterfall([
		function (next) {
			plugins.fireHook('filter:widget.render:' + widget.widget, {
				uid: uid,
				area: area,
				data: widget.data,
				req: req,
				res: res,
			}, next);
		},
		function (data, next) {
			if (!data) {
				return callback();
			}
			var html = data;
			if (typeof html !== 'string') {
				html = data.html;
			} else {
				winston.warn('[widgets.render] passing a string is deprecated!, filter:widget.render:' + widget.widget + '. Please set hookData.html in your plugin.');
			}

			if (widget.data.container && widget.data.container.match('{body}')) {
				translator.translate(widget.data.title, function (title) {
					html = templates.parse(widget.data.container, {
						title: title,
						body: html,
					});

					next(null, { html: html });
				});
			} else {
				next(null, { html: html });
			}
		},
	], callback);
}

widgets.getAreas = function (templates, locations, callback) {
	var keys = templates.map(function (tpl) {
		return 'widgets:' + tpl;
	});
	async.waterfall([
		function (next) {
			db.getObjectsFields(keys, locations, next);
		},
		function (data, next) {
			var returnData = {};

			templates.forEach(function (template, index) {
				returnData[template] = returnData[template] || {};
				locations.forEach(function (location) {
					if (data && data[index] && data[index][location]) {
						try {
							returnData[template][location] = JSON.parse(data[index][location]);
						} catch (err) {
							winston.error('can not parse widget data. template:  ' + template + ' location: ' + location);
							returnData[template][location] = [];
						}
					} else {
						returnData[template][location] = [];
					}
				});
			});

			next(null, returnData);
		},
	], callback);
};

widgets.getArea = function (template, location, callback) {
	async.waterfall([
		function (next) {
			db.getObjectField('widgets:' + template, location, next);
		},
		function (result, next) {
			if (!result) {
				return callback(null, []);
			}
			try {
				result = JSON.parse(result);
			} catch (err) {
				return callback(err);
			}

			next(null, result);
		},
	], callback);
};

widgets.setArea = function (area, callback) {
	if (!area.location || !area.template) {
		return callback(new Error('Missing location and template data'));
	}

	db.setObjectField('widgets:' + area.template, area.location, JSON.stringify(area.widgets), callback);
};

widgets.reset = function (callback) {
	var defaultAreas = [
		{ name: 'Draft Zone', template: 'global', location: 'header' },
		{ name: 'Draft Zone', template: 'global', location: 'footer' },
		{ name: 'Draft Zone', template: 'global', location: 'sidebar' },
	];
	var drafts;
	async.waterfall([
		function (next) {
			async.parallel({
				areas: function (next) {
					plugins.fireHook('filter:widgets.getAreas', defaultAreas, next);
				},
				drafts: function (next) {
					widgets.getArea('global', 'drafts', next);
				},
			}, next);
		},
		function (results, next) {
			drafts = results.drafts || [];

			async.each(results.areas, function (area, next) {
				async.waterfall([
					function (next) {
						widgets.getArea(area.template, area.location, next);
					},
					function (areaData, next) {
						drafts = drafts.concat(areaData);
						area.widgets = [];
						widgets.setArea(area, next);
					},
				], next);
			}, next);
		},
		function (next) {
			widgets.setArea({
				template: 'global',
				location: 'drafts',
				widgets: drafts,
			}, next);
		},
	], callback);
};

module.exports = widgets;
