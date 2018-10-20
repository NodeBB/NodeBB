'use strict';

var async = require('async');
var winston = require('winston');
var _ = require('lodash');
var Benchpress = require('benchpressjs');

var plugins = require('../plugins');
var translator = require('../translator');
var db = require('../database');
var apiController = require('../controllers/api');
var meta = require('../meta');

var widgets = module.exports;

widgets.render = function (uid, options, callback) {
	if (!options.template) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			widgets.getWidgetDataForTemplates(['global', options.template], next);
		},
		function (data, next) {
			var widgetsByLocation = {};

			delete data.global.drafts;

			var locations = _.uniq(Object.keys(data.global).concat(Object.keys(data[options.template])));

			var returnData = {};

			async.each(locations, function (location, done) {
				widgetsByLocation[location] = (data[options.template][location] || []).concat(data.global[location] || []);

				if (!widgetsByLocation[location].length) {
					return done(null, { location: location, widgets: [] });
				}

				async.map(widgetsByLocation[location], function (widget, next) {
					if (!widget || !widget.data ||
						(!!widget.data['hide-registered'] && uid !== 0) ||
						(!!widget.data['hide-guests'] && uid === 0) ||
						(!!widget.data['hide-mobile'] && options.req.useragent.isMobile)) {
						return next();
					}

					renderWidget(widget, uid, options, next);
				}, function (err, renderedWidgets) {
					if (err) {
						return done(err);
					}
					renderedWidgets = renderedWidgets.filter(Boolean);
					returnData[location] = renderedWidgets.length ? renderedWidgets : undefined;

					done();
				});
			}, function (err) {
				next(err, returnData);
			});
		},
	], callback);
};

function renderWidget(widget, uid, options, callback) {
	var userLang;
	async.waterfall([
		function (next) {
			if (options.res.locals.isAPI) {
				apiController.loadConfig(options.req, next);
			} else {
				next(null, options.res.locals.config || {});
			}
		},
		function (config, next) {
			userLang = config.userLang || meta.config.defaultLang || 'en-GB';
			var templateData = _.assign({ }, options.templateData, { config: config });
			plugins.fireHook('filter:widget.render:' + widget.widget, {
				uid: uid,
				area: options,
				templateData: templateData,
				data: widget.data,
				req: options.req,
				res: options.res,
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
				Benchpress.compileParse(widget.data.container, {
					title: widget.data.title,
					body: html,
					template: data.templateData.template,
				}, next);
			} else {
				next(null, html);
			}
		},
		function (html, next) {
			translator.translate(html, userLang, function (translatedHtml) {
				next(null, { html: translatedHtml });
			});
		},
	], callback);
}

widgets.getWidgetDataForTemplates = function (templates, callback) {
	var keys = templates.map(function (tpl) {
		return 'widgets:' + tpl;
	});

	async.waterfall([
		function (next) {
			db.getObjects(keys, next);
		},
		function (data, next) {
			var returnData = {};

			templates.forEach(function (template, index) {
				returnData[template] = returnData[template] || {};

				var templateWidgetData = data[index] || {};
				var locations = Object.keys(templateWidgetData);

				locations.forEach(function (location) {
					if (templateWidgetData && templateWidgetData[location]) {
						try {
							returnData[template][location] = JSON.parse(templateWidgetData[location]);
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

			async.eachSeries(results.areas, function (area, next) {
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

widgets.resetTemplate = function (template, callback) {
	var toBeDrafted = [];
	async.waterfall([
		function (next) {
			db.getObject('widgets:' + template + '.tpl', next);
		},
		function (area, next) {
			for (var location in area) {
				if (area.hasOwnProperty(location)) {
					toBeDrafted = toBeDrafted.concat(JSON.parse(area[location]));
				}
			}
			db.delete('widgets:' + template + '.tpl', next);
		},
		function (next) {
			db.getObjectField('widgets:global', 'drafts', next);
		},
		function (draftWidgets, next) {
			draftWidgets = JSON.parse(draftWidgets).concat(toBeDrafted);
			db.setObjectField('widgets:global', 'drafts', JSON.stringify(draftWidgets), next);
		},
	], callback);
};

widgets.resetTemplates = function (templates, callback) {
	async.eachSeries(templates, widgets.resetTemplate, callback);
};

module.exports = widgets;
