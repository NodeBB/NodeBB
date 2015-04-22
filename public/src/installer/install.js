"use strict";
/*global utils*/

$('document').ready(function() {
	setupInputs();
	$('[name="username"]').focus();



	function setupInputs() {
		$('form').on('focus', '.form-control', function() {
			var parent = $(this).parents('.input-row');

			$('.input-row.active').removeClass('active');
			parent.addClass('active').removeClass('error');

			var help = parent.find('.help-text');
			help.html(help.attr('data-help'));
		});

		$('form').on('blur change', '[name]', function() {
			activate($(this).attr('name'), $(this));
		});

		activate('database', $('[name="database"]'));
	}

	function activate(type, el) {
		var field = el.val(),
			parent = el.parents('.input-row'),
			help = parent.children('.help-text');

		function validateUsername(field) {
			console.log('derp');
			if (!utils.isUserNameValid(field) || !utils.slugify(field)) {
				console.log('derp1');
				parent.addClass('error');
				help.html('Invalid Username.');
			} else {
				console.log('derp2');
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

		function switchDatabase(field) {
			console.log(field);
			$('#database-config').html($('[data-database="' + field + '"]').html());
		}

		switch (type) {
			case 'admin:username':
				return validateUsername(field);
			case 'admin:password':
				return validatePassword(field);
			case 'admin:confirm':
				return validateConfirmPassword(field);
			case 'admin:email':
				return validateEmail(field);
			case 'database':
				return switchDatabase(field);
		}
	}
});