'use strict';

define('messages', ['bootbox', 'translator', 'storage', 'alerts'], function (bootbox, translator, storage, alerts) {
	const messages = {};

	let showWelcomeMessage;
	let registerMessage;

	messages.show = function () {
		showQueryStringMessages();
		showCookieWarning();
		messages.showEmailConfirmWarning();
	};

	messages.showEmailConfirmWarning = function (message) {
		if (!config.emailPrompt || !app.user.uid || parseInt(storage.getItem('email-confirm-dismiss'), 10) === 1) {
			return;
		}
		const msg = {
			alert_id: 'email_confirm',
			type: 'warning',
			timeout: 0,
			closefn: () => {
				storage.setItem('email-confirm-dismiss', 1);
			},
		};

		if (!app.user.email) {
			msg.message = '[[error:no-email-to-confirm]]';
			msg.clickfn = function () {
				app.removeAlert('email_confirm');
				ajaxify.go('user/' + app.user.userslug + '/edit/email');
			};
			app.alert(msg);
		} else if (!app.user['email:confirmed'] && !app.user.isEmailConfirmSent) {
			msg.message = message || '[[error:email-not-confirmed]]';
			msg.clickfn = function () {
				app.removeAlert('email_confirm');
				socket.emit('user.emailConfirm', {}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[notifications:email-confirm-sent]]');
				});
			};
			app.alert(msg);
		} else if (!app.user['email:confirmed'] && app.user.isEmailConfirmSent) {
			msg.message = '[[error:email-not-confirmed-email-sent]]';
			app.alert(msg);
		}
	};

	function showCookieWarning() {
		if (!config.cookies.enabled || !navigator.cookieEnabled || app.inAdmin || storage.getItem('cookieconsent') === '1') {
			return;
		}

		config.cookies.message = translator.unescape(config.cookies.message);
		config.cookies.dismiss = translator.unescape(config.cookies.dismiss);
		config.cookies.link = translator.unescape(config.cookies.link);
		config.cookies.link_url = translator.unescape(config.cookies.link_url);

		app.parseAndTranslate('partials/cookie-consent', config.cookies, function (html) {
			$(document.body).append(html);
			$(document.body).addClass('cookie-consent-open');

			const warningEl = $('.cookie-consent');
			const dismissEl = warningEl.find('button');
			dismissEl.on('click', function () {
				// Save consent cookie and remove warning element
				storage.setItem('cookieconsent', '1');
				warningEl.remove();
				$(document.body).removeClass('cookie-consent-open');
			});
		});
	}

	function showQueryStringMessages() {
		const params = utils.params();
		showWelcomeMessage = !!params.loggedin;
		registerMessage = params.register;

		if (showWelcomeMessage) {
			alerts.alert({
				type: 'success',
				title: '[[global:welcome_back]] ' + app.user.username + '!',
				message: '[[global:you_have_successfully_logged_in]]',
				timeout: 5000,
			});
		}

		if (registerMessage) {
			bootbox.alert({
				message: utils.escapeHTML(decodeURIComponent(registerMessage)),
			});
		}
	}

	messages.showInvalidSession = function () {
		bootbox.alert({
			title: '[[error:invalid-session]]',
			message: '[[error:invalid-session-text]]',
			closeButton: false,
			callback: function () {
				window.location.reload();
			},
		});
	};

	messages.showSessionMismatch = function () {
		bootbox.alert({
			title: '[[error:session-mismatch]]',
			message: '[[error:session-mismatch-text]]',
			closeButton: false,
			callback: function () {
				window.location.reload();
			},
		});
	};

	return messages;
});
