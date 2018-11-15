'use strict';

var async = require('async');

module.exports = {
	name: 'Widget visibility groups',
	timestamp: Date.UTC(2018, 10, 10),
	method: function (callback) {
		const widgetAdmin = require('../../widgets/admin');
		const widgets = require('../../widgets');
		async.waterfall([
			function (next) {
				widgetAdmin.getAreas(next);
			},
			function (areas, next) {
				async.eachSeries(areas, function (area, next) {
					if (area.data.length) {
						// area.data is actually an array of widgets
						area.widgets = area.data;
						area.widgets.forEach(function (widget) {
							if (widget && widget.data) {
								const groupsToShow = ['administrators', 'Global Moderators'];
								if (widget.data['hide-guests'] !== 'on') {
									groupsToShow.push('guests');
								}
								if (widget.data['hide-registered'] !== 'on') {
									groupsToShow.push('registered-users');
								}

								widget.data.groups = groupsToShow;

								// if we are showing to all 4 groups, set to empty array
								// empty groups is shown to everyone
								if (groupsToShow.length === 4) {
									widget.data.groups.length = 0;
								}
							}
						});
						widgets.setArea(area, next);
					} else {
						next();
					}
				}, next);
			},
		], callback);
	},
};
