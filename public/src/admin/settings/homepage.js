'use strict';


define('admin/settings/homepage', ['admin/settings'], function () {
	function toggleCustomRoute() {
		if ($('[data-field="homePageRoute"]').val() === 'custom') {
			$('#homePageCustom').show();
		} else {
			$('#homePageCustom').hide();
		}
	}

	const Homepage = {};

	Homepage.init = function () {
		$('[data-field="homePageRoute"]').on('change', toggleCustomRoute);

		toggleCustomRoute();
	};

	return Homepage;
});
