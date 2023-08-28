'use strict';

import * as components from './components';
import * as hooks from './hooks';

export function alert(params) {
	params.alert_id = 'alert_button_' + (params.alert_id ? params.alert_id : new Date().getTime());
	params.title = params.title ? params.title.trim() || '' : '';
	params.message = params.message ? params.message.trim() : '';
	params.type = params.type || 'info';

	const alert = $('#' + params.alert_id);
	if (alert.length) {
		updateAlert(alert, params);
	} else {
		createNew(params);
	}
}

export function success(message, timeout) {
	alert({
		alert_id: utils.generateUUID(),
		title: '[[global:alert.success]]',
		message: message,
		type: 'success',
		timeout: timeout !== undefined ? timeout : 5000,
	});
}

export function info(message, timeout) {
	alert({
		alert_id: utils.generateUUID(),
		title: '[[global:alert.info]]',
		message: message,
		type: 'info',
		timeout: timeout !== undefined ? timeout : 5000,
	});
}

export function warning(message, timeout) {
	alert({
		alert_id: utils.generateUUID(),
		title: '[[global:alert.warning]]',
		message: message,
		type: 'warning',
		timeout: timeout !== undefined ? timeout : 5000,
	});
}

export function error(message, timeout) {
	message = (message && message.message) || message;

	if (message === '[[error:revalidate-failure]]') {
		socket.disconnect();
		app.reconnect();
		return;
	}

	alert({
		alert_id: utils.generateUUID(),
		title: '[[global:alert.error]]',
		message: message,
		type: 'danger',
		timeout: timeout || 10000,
	});
}

export function remove(id) {
	$('#alert_button_' + id).remove();
}

function updateAlert(alert, params) {
	alert.find('strong').translateHtml(params.title);
	alert.find('p').translateHtml(params.message);
	alert.removeClass('alert-success alert-danger alert-info alert-warning')
		.addClass(`alert-${params.type}`);

	clearTimeout(parseInt(alert.attr('timeoutId'), 10));
	if (params.timeout) {
		startTimeout(alert, params);
	}

	hooks.fire('action:alert.update', { alert, params });

	// Handle changes in the clickfn
	alert.off('click').removeClass('pointer');
	if (typeof params.clickfn === 'function') {
		alert
			.addClass('pointer')
			.on('click', function (e) {
				if (!$(e.target).is('.btn-close')) {
					params.clickfn();
					close(alert);
				}
			});
	}
}

function createNew(params) {
	app.parseAndTranslate('partials/toast', params, function (html) {
		let alert = $('#' + params.alert_id);
		if (alert.length) {
			return updateAlert(alert, params);
		}
		alert = html;

		alert.hide().fadeIn(200).prependTo(components.get('toaster/tray'));

		alert.on('close.bs.alert', function () {
			if (typeof params.closefn === 'function') {
				params.closefn();
			}
			const timeoutId = alert.attr('timeoutId');

			if (timeoutId) {
				clearTimeout(timeoutId);
				alert.removeAttr('timeoutId');
			}
		});

		if (parseInt(params.timeout, 10)) {
			startTimeout(alert, params);
		}

		if (typeof params.clickfn === 'function') {
			alert
				.addClass('pointer')
				.on('click', function (e) {
					if (!$(e.target).is('.btn-close')) {
						params.clickfn(alert, params);
						close(alert);
					}
				});
		}

		hooks.fire('action:alert.new', { alert, params });
	});
}

function close(alert) {
	alert.alert('close');
}

function startTimeout(alert, params) {
	const timeout = parseInt(params.timeout, 10);

	const timeoutId = setTimeout(function () {
		alert.removeAttr('timeoutId');
		close(alert);

		if (typeof params.timeoutfn === 'function') {
			params.timeoutfn(alert, params);
		}
	}, timeout);

	alert.attr('timeoutId', timeoutId);

	// Reset and start animation
	const alertProgress = alert.find('.alert-progress');
	alertProgress.css('transition-property', 'none');
	alertProgress.removeClass('animate');

	setTimeout(function () {
		alertProgress.css('transition-property', '');
		alertProgress.css('transition', 'width ' + (timeout + 450) + 'ms linear');
		alertProgress.addClass('animate');
		hooks.fire('action:alert.animate', { alert, alertProgress, params });
	}, 50);

	// Handle mouseenter/mouseleave
	alert
		.on('mouseenter', function () {
			alertProgress.css('transition-duration', 0);
		});
}

