"use strict";
/*global define*/

define('admin/general/homepage', ['admin/settings'], function(Settings) {

	function toggleCustomRoute() {
		if ($('[data-field="homePageRoute"]').val()) {
			$('#homePageCustom').hide();
		}else{
			$('#homePageCustom').show();
		}
	}

	var Homepage = {};

	Homepage.init = function() {
		$('[data-field="homePageRoute"]').on('change', toggleCustomRoute);

		toggleCustomRoute();
	};

	return Homepage;
});
