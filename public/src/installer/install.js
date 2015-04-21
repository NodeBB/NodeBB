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

		$('[name]').on('blur', function() {
			validate($(this).attr('name'), $(this));
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

		function validateConfirmPassword(field) {
			if ($('[name="password"]').val() !== $('[name="confirm"]').val()) {
				parent.addClass('error');
				help.html('Passwords do not match.');
			} else {
				parent.removeClass('error');
			}
		}

		function validateEmail(field) {
			if (!utils.isEmailValid(field)) {
				parent.addClass('error');
				help.html('Invalid Email Address.');
			} else {
				parent.removeClass('error');
			}
		}

		switch (type) {
			case 'username':
				return validateUsername(field);
			case 'password':
				return validatePassword(field);
			case 'confirm':
				return validateConfirmPassword(field);
			case 'email':
				return validateEmail(field);
		}
	}
});