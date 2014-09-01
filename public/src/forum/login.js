"use strict";
/* global define, app, RELATIVE_PATH */

define('forum/login', function() {
	var	Login = {};

	Login.init = function() {
		$('#login').on('click', function(e) {
			$('#login-error-notify').hide();
		});

		$('#login-error-notify button').on('click', function(e) {
			e.preventDefault();
			$('#login-error-notify').hide();
		});

		$('#content #username').focus();
	};

	return Login;
});
