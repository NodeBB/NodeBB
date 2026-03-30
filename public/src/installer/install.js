'use strict';

const $ = require('jquery');
require('bootstrap');
const zxcvbn = require('zxcvbn');
const utils = require('../utils');
const slugify = require('../modules/slugify');

$('document').ready(function () {
	setupInputs();
	$('[name="username"]').focus();

	activate('database', $('[name="database"]'));

	$('#test-database').on('click', function () {
		const conf = {};
		$('#database-config input[name]').each((i, el) => {
			conf[$(el).attr('name')] = $(el).val();
		});
		$('#test-database-spinner').removeClass('hidden');
		$('#database-success').addClass('hidden');
		$('#database-error').addClass('hidden');
		$('#database-full').addClass('hidden');
		const qs = new URLSearchParams(conf).toString();
		$.ajax({
			url: `/testdb?${qs}`,
			success: function (res) {
				$('#test-database-spinner').addClass('hidden');
				if (res.success) {
					$('#database-success').removeClass('hidden');
					if (res.dbfull) {
						$('#database-full').removeClass('hidden')
							.text('Found existing install in this database!');
					}
				} else if (res.error) {
					$('#database-error').removeClass('hidden').text(res.error);
				}
			},
			error: function (jqXHR, textStatus) {
				$('#test-database-spinner').addClass('hidden');
				$('#database-error').removeClass('hidden').text(textStatus);
			},
		});

		return false;
	});

	function checkIfReady() {
		let successCount = 0;
		const url = $('#installing').attr('data-url');
		const progressEl = $('#installing .progress-bar');
		setInterval(function () {
			let p = parseFloat(progressEl.attr('data-percent'), 10) || 0;
			p = Math.min(100, p + 0.5);
			progressEl.attr('data-percent', p);
			progressEl.css({ width: p + '%' });
		}, 1000);
		setInterval(function () {
			$.get(url + '/admin').done(function () {
				if (successCount >= 5) {
					window.location = url + '/admin';
				} else {
					successCount += 1;
				}
			});
		}, 2500);
	}

	if ($('#installing').length) {
		checkIfReady();
	}

	function setupInputs() {
		$('form').on('focus', '.form-control', function () {
			const parent = $(this).parents('.input-row');

			$('.input-row.active').removeClass('active');
			parent.addClass('active').removeClass('error');

			const help = parent.find('.form-text');
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
		const field = el.val();
		const parent = el.parents('.input-row');
		const help = parent.children('.form-text');

		function validateUsername(field) {
			if (!utils.isUserNameValid(field) || !slugify(field)) {
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
			} else if (zxcvbn(field).score < parseInt($('[name="admin:password"]').attr('data-minimum-strength'), 10)) {
				parent.addClass('error');
				help.html('Password is too weak.');
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
			$('#database-success').addClass('hidden');
			$('#database-error').addClass('hidden');
			$('#database-full').addClass('hidden');
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
});
