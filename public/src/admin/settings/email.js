'use strict';


define('admin/settings/email', ['ace/ace', 'admin/settings'], function (ace) {
	var module = {};
	var emailEditor;

	module.init = function () {
		configureEmailTester();
		configureEmailEditor();
		handleDigestHourChange();
		handleSmtpServiceChange();

		$(window).on('action:admin.settingsLoaded action:admin.settingsSaved', handleDigestHourChange);
		$(window).on('action:admin.settingsSaved', function () {
			socket.emit('admin.user.restartJobs');
		});
		$('[id="email:smtpTransport:service"]').change(handleSmtpServiceChange);
	};

	function configureEmailTester() {
		$('button[data-action="email.test"]').off('click').on('click', function () {
			socket.emit('admin.email.test', { template: $('#test-email').val() }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('Test Email Sent');
			});
			return false;
		});
	}

	function configureEmailEditor() {
		$('#email-editor-selector').on('change', updateEmailEditor);

		emailEditor = ace.edit('email-editor');
		emailEditor.$blockScrolling = Infinity;
		emailEditor.setTheme('ace/theme/twilight');
		emailEditor.getSession().setMode('ace/mode/html');

		emailEditor.on('change', function () {
			var emailPath = $('#email-editor-selector').val();
			var original;
			ajaxify.data.emails.forEach(function (email) {
				if (email.path === emailPath) {
					original = email.original;
				}
			});
			var newEmail = emailEditor.getValue();
			$('#email-editor-holder').val(newEmail !== original ? newEmail : '');
		});

		$('button[data-action="email.revert"]').off('click').on('click', function () {
			ajaxify.data.emails.forEach(function (email) {
				if (email.path === $('#email-editor-selector').val()) {
					emailEditor.getSession().setValue(email.original);
					$('#email-editor-holder').val('');
				}
			});
		});

		updateEmailEditor();
	}

	function updateEmailEditor() {
		ajaxify.data.emails.forEach(function (email) {
			if (email.path === $('#email-editor-selector').val()) {
				emailEditor.getSession().setValue(email.text);
				$('#email-editor-holder')
					.val(email.text !== email.original ? email.text : '')
					.attr('data-field', 'email:custom:' + email.path);
			}
		});
	}

	function handleDigestHourChange() {
		var hour = parseInt($('#digestHour').val(), 10);

		if (isNaN(hour)) {
			hour = 17;
		} else if (hour > 23 || hour < 0) {
			hour = 0;
		}

		socket.emit('meta.getServerTime', {}, function (err, now) {
			if (err) {
				return app.alertError(err.message);
			}

			now = new Date(now);

			$('#serverTime').text(now.toString());

			now.setHours(parseInt(hour, 10), 0, 0, 0);

			// If adjusted time is in the past, move to next day
			if (now.getTime() < Date.now()) {
				now.setDate(now.getDate() + 1);
			}

			$('#nextDigestTime').text(now.toString());
		});
	}

	function handleSmtpServiceChange() {
		var isCustom = $('[id="email:smtpTransport:service"]').val() === 'nodebb-custom-smtp';
		$('[id="email:smtpTransport:custom-service"]')[isCustom ? 'slideDown' : 'slideUp'](isCustom);
	}

	return module;
});
