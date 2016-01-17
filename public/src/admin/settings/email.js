"use strict";
/* global define, socket, app, ajaxify, ace */

define('admin/settings/email', ['admin/settings'], function(settings) {
	var module = {},
		emailEditor;

	module.init = function() {
		configureEmailTester();
		configureEmailEditor();
	};

	function configureEmailTester() {
		$('button[data-action="email.test"]').off('click').on('click', function() {
			socket.emit('admin.email.test', {template: $('#test-email').val()}, function(err) {
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

		emailEditor = ace.edit("email-editor");
		emailEditor.setTheme("ace/theme/twilight");
		emailEditor.getSession().setMode("ace/mode/html");

		emailEditor.on('change', function(e) {
		    $('#email-editor-holder').val(emailEditor.getValue());
		});

		$('button[data-action="email.revert"]').off('click').on('click', function() {
			ajaxify.data.emails.forEach(function(email) {
				if (email.path === $('#email-editor-selector').val()) {
					emailEditor.getSession().setValue(email.original);
					$('#email-editor-holder')
						.val(email.original);
				}
			});
		});

		updateEmailEditor();
	}

	function updateEmailEditor() {
		ajaxify.data.emails.forEach(function(email) {
			if (email.path === $('#email-editor-selector').val()) {
				emailEditor.getSession().setValue(email.text);
				$('#email-editor-holder')
					.val(email.text)
					.attr('data-field', 'email:custom:' + email.path);
			}
		});
	}

	return module;
});