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

		$('[name="username"]').on('blur', function() {
			validate('username', $(this));
		});
		$('[name="password"]').on('blur', function() {
			validate('password', $(this));
		});
	}

	function validate(type, el) {
		var field = el.val(),
			parent = el.parents('.input-row'),
			help = parent.children('.help-text');

		function validateUsername(field) {
			if (!utils.isUserNameValid(field) || !utils.slugify(field)) {
				parent.addClass('error');
				help.html('Invalid Username.');
			} else {
				parent.removeClass('error');
			}
		}

		function validatePassword(field) {
			if (!utils.isPasswordValid(field)) {
				parent.addClass('error');
				help.html('Invalid Password.');
			} else {
				parent.removeClass('error');
			}
		}

		switch (type) {
			case 'username':
				return validateUsername(field);
			case 'password':
				return validatePassword(field);
		}
	}
});