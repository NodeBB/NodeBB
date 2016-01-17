"use strict";
/*global utils*/

$('document').ready(function() {
	setupInputs();
	$('[name="username"]').focus();

	activate('database', $('[name="database"]'));

	if ($('#database-error').length) {
		$('[name="database"]').parents('.input-row').addClass('error');
		$('html, body').animate({
			scrollTop: ($('#database-error').offset().top + 100) + 'px'
		}, 400);
	}

	$('#launch').on('click', launchForum);



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

		$('form').submit(validateAll);
	}

	function validateAll(ev) {
		$('form .admin [name]').each(function() {
			activate($(this).attr('name'), $(this));
		});

		if ($('form .admin .error').length) {
			ev.preventDefault();
			$('html, body').animate({'scrollTop': '0px'}, 400);
			
			return false;
		} else {
			$('#submit .fa-spin').removeClass('hide');
		}
	}

	function activate(type, el) {
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
			if ($('[name="admin:password"]').val() !== $('[name="admin:passwordConfirm"]').val()) {
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
			$('#database-config').html($('[data-database="' + field + '"]').html());
		}

		switch (type) {
			case 'admin:username':
				return validateUsername(field);
			case 'admin:password':
				return validatePassword(field);
			case 'admin:passwordConfirm':
				return validateConfirmPassword(field);
			case 'admin:email':
				return validateEmail(field);
			case 'database':
				return switchDatabase(field);
		}
	}

	function launchForum() {
		$('#launch .fa-spin').removeClass('hide');

		$.post('/launch', function() {
			setInterval(function() {
				$.get('/admin').done(function(data) {
					window.location = 'admin';
				});
			}, 750);
		});
	}
});