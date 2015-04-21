"use strict";
/*global utils*/

$('document').ready(function() {
	setupInputs();



	function setupInputs() {
		$('.form-control').on('focus', function() {
			$('.input-row.active').removeClass('active');
			$(this).parents('.input-row').addClass('active');
		});

		$('[name="username"]').on('blur', validateUsername);
	}


	function validateUsername() {
		var $this = $(this),
			username = $this.val(),
			help = $this.parents('.input-row').children('.help-text');

		if (!utils.isUserNameValid(username) || !utils.slugify(username)) {
			help.html('Invalid Username.');
		} else {
			help.html('');
		}
	}
});