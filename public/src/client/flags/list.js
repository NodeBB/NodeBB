'use strict';

/* globals define */

define('forum/flags/list', ['components'], function (components) {
	var Flags = {};

	Flags.init = function () {
		Flags.enableFilterForm();
	};

	Flags.enableFilterForm = function () {
		var filtersEl = components.get('flags/filters');

		// Parse ajaxify data to set form values to reflect current filters
		for(var filter in ajaxify.data.filters) {
			filtersEl.find('[name="' + filter + '"]').val(ajaxify.data.filters[filter]);
		}

		filtersEl.find('button').on('click', function () {
			var payload = filtersEl.serializeArray();
			var qs = payload.map(function (filter) {
				if (filter.value) {
					return filter.name + '=' + filter.value;
				}
			}).filter(Boolean).join('&');

			ajaxify.go('flags?' + qs);
		})
	};

	return Flags;
});
