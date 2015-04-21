"use strict";

$('document').ready(function() {
	setupInputs();



	function setupInputs() {
		$('.form-control').on('focus', function() {
			$('.input-row.active').removeClass('active');
			$(this).parents('.input-row').addClass('active');
		});
	}
});