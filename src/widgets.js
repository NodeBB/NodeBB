var async = require('async'),
	winston = require('winston'),
	db = require('./database');


(function(Widgets) {

	Widgets.getArea = function(template, location, callback) {
		db.getObjectField('widgets:' + template, location, function(err, widgets) {
			callback(err, JSON.parse(widgets));
		})
	};

	Widgets.setArea = function(data, callback) {
		if (!data.location || !data.template) {
			callback({
				error: 'Missing location and template data'
			});
		}
		
		db.setObjectField('widgets:' + data.template, data.location, JSON.stringify(data.widgets), function(err) {
			callback(err);
		});
	};

}(exports));