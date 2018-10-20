'use strict';


$('document').ready(function () {
	setupInputs();
	$('[name="username"]').focus();

	activate('database', $('[name="database"]'));

	if ($('#database-error').length) {
		$('[name="database"]').parents('.input-row').addClass('error');
		$('html, body').animate({
			scrollTop: ($('#database-error').offset().top + 100) + 'px',
		}, 400);
	}

	$('#launch').on('click', launchForum);

	if ($('#installing').length) {
		setTimeout(function () {
			window.location.reload(true);
		}, 5000);
	}

	function setupInputs() {
		$('form').on('focus', '.form-control', function () {
			var parent = $(this).parents('.input-row');

			$('.input-row.active').removeClass('active');
			parent.addClass('active').removeClass('error');

			var help = parent.find('.help-text');
			help.html(help.attr('data-help'));
		});

		$('form').on('blur change', '[name]', function () {
			activate($(this).attr('name'), $(this));
		});

		$('form').submit(validateAll);
	}

	function validateAll(ev) {
		$('form .admin [name]').each(function () {
			activate($(this).attr('name'), $(this));
		});

		if ($('form .admin .error').length) {
			ev.preventDefault();
			$('html, body').animate({ scrollTop: '0px' }, 400);

			return false;
		}
		$('#submit .working').removeClass('hide');
	}

	function activate(type, el) {
		var field = el.val();
		var parent = el.parents('.input-row');
		var help = parent.children('.help-text');

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
			} else if (field.length < $('[name="admin:password"]').attr('data-minimum-length')) {
				parent.addClass('error');
				help.html('Password is too short.');
			} else {
				parent.removeClass('error');
			}
		}

		function validateConfirmPassword() {
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
		$('#launch .working').removeClass('hide');
		$.post('/launch', function () {
			var successCount = 0;
			var url = $('#launch').attr('data-url');
			setInterval(function () {
				$.get(url + '/admin').done(function () {
					if (successCount >= 5) {
						window.location = 'admin';
					} else {
						successCount += 1;
					}
				});
			}, 750);
		});
	}
});
