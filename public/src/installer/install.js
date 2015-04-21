"use strict";
/*global utils*/

$('document').ready(function() {
	setupInputs();
	$('[name="username"]').focus();



	function setupInputs() {
		$('.form-control').on('focus', function() {
			var parent = $(this).parents('.input-row');

			$('.input-row.active').removeClass('active');
			parent.addClass('active').removeClass('error');

			var help = parent.find('.help-text');
			help.html(help.attr('data-help'));
		});

		$('[name="username"]').on('blur', validateUsername);
	}


	function validateUsername() {
		var $this = $(this),
			username = $this.val(),
			parent = $this.parents('.input-row'),
			help = parent.children('.help-text');

		if (!utils.isUserNameValid(username) || !utils.slugify(username)) {
			parent.addClass('error');
			help.html('Invalid Username.');
		} else {
			parent.removeClass('error');
		}
	}
});