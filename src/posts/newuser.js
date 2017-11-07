'use strict';


define('admin/settings/general', ['admin/settings'], function () {
	var Module = {};

	Module.init = function () {
		$('input[data-type="newUserRestrictions"]').attr('disabled', true);
	};

	return Module;
});

$('[data-field="toggleUserRestrictions"]').on('click', function() {
  // code to toggle disable attribute for inputs
});