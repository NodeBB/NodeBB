"use strict";

var async = require('async'),
	nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	templatesController = {};


var availableTemplatesCache = null;
var configCache = null;

templatesController.getTemplatesListing = function(req, res, next) {
	async.parallel({
		availableTemplates: function(next) {
			getAvailableTemplates(next);
		},
		templatesConfig: function(next) {
			async.waterfall([
				function(next) {
					readConfigFile(next);
				},
				function(config, next) {
					config.custom_mapping['^/?$'] = meta.config.homePageRoute || 'home';

				 	plugins.fireHook('filter:templates.get_config', config, next);
				}
			], next);
		},
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		res.json(results);
	});
};

function readConfigFile(callback) {
	if (configCache) {
		return callback(null, configCache);
	}
	fs.readFile(path.join(nconf.get('views_dir'), 'config.json'), function(err, config) {
		if (err) {
			return callback(err);
		}
		try {
			config = JSON.parse(config.toString());
		} catch (err) {
			return callback(err);
		}
		configCache = config;
		callback(null, config);
	});
}

function getAvailableTemplates(callback) {
	if (availableTemplatesCache) {
		return callback(null, availableTemplatesCache);
	}

	async.parallel({
		views: function(next) {
			utils.walk(nconf.get('views_dir'), next);
		},
		extended: function(next) {
			plugins.fireHook('filter:templates.get_virtual', [], next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}
		var availableTemplates = results.views.filter(function(value, index, self) {
			return value && self.indexOf(value) === index;
		}).map(function(el) {
			return el && el.replace(nconf.get('views_dir') + '/', '');
		});

		availableTemplatesCache = availableTemplates.concat(results.extended);
		callback(null, availableTemplatesCache);
	});

}



module.exports = templatesController;
