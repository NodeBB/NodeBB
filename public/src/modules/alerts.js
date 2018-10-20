'use strict';


define('alerts', ['translator', 'components', 'benchpress'], function (translator, components, Benchpress) {
	var module = {};

	module.alert = function (params) {
		params.alert_id = 'alert_button_' + (params.alert_id ? params.alert_id : new Date().getTime());
		params.title = params.title ? params.title.trim() || '' : '';
		params.message = params.message ? params.message.trim() : '';
		params.type = params.type || 'info';

		var alert = $('#' + params.alert_id);
		if (alert.length) {
			updateAlert(alert, params);
		} else {
			createNew(params);
		}
	};

	function createNew(params) {
		Benchpress.parse('alert', params, function (alertTpl) {
			translator.translate(alertTpl, function (translatedHTML) {
				var alert = $('#' + params.alert_id);
				if (alert.length) {
					return updateAlert(alert, params);
				}
				alert = $(translatedHTML);
				alert.fadeIn(200);

				components.get('toaster/tray').prepend(alert);

				if (typeof params.closefn === 'function') {
					alert.find('button').on('click', function () {
						params.closefn();
						fadeOut(alert);
						return false;
					});
				}

				if (params.timeout) {
					startTimeout(alert, params.timeout);
				}

				if (typeof params.clickfn === 'function') {
					alert
						.addClass('pointer')
						.on('click', function (e) {
							if (!$(e.target).is('.close')) {
								params.clickfn();
							}
							fadeOut(alert);
						});
				}
			});
		});
	}

	module.remove = function (id) {
		$('#alert_button_' + id).remove();
	};

	function updateAlert(alert, params) {
		alert.find('strong').html(params.title);
		alert.find('p').html(params.message);
		alert.attr('class', 'alert alert-dismissable alert-' + params.type + ' clearfix');

		clearTimeout(parseInt(alert.attr('timeoutId'), 10));
		if (params.timeout) {
			startTimeout(alert, params.timeout);
		}

		alert.children().fadeOut(100);
		translator.translate(alert.html(), function (translatedHTML) {
			alert.children().fadeIn(100);
			alert.html(translatedHTML);
		});

		// Handle changes in the clickfn
		alert.off('click').removeClass('pointer');
		if (typeof params.clickfn === 'function') {
			alert
				.addClass('pointer')
				.on('click', function (e) {
					if (!$(e.target).is('.close')) {
						params.clickfn();
					}
					fadeOut(alert);
				});
		}
	}

	function fadeOut(alert) {
		alert.fadeOut(500, function () {
			$(this).remove();
		});
	}

	function startTimeout(alert, timeout) {
		var timeoutId = setTimeout(function () {
			fadeOut(alert);
		}, timeout);

		alert.attr('timeoutId', timeoutId);

		// Reset and start animation
		alert.css('transition-property', 'none');
		alert.removeClass('animate');

		setTimeout(function () {
			alert.css('transition-property', '');
			alert.css('transition', 'width ' + (timeout + 450) + 'ms linear, background-color ' + (timeout + 450) + 'ms ease-in');
			alert.addClass('animate');
		}, 50);

		// Handle mouseenter/mouseleave
		alert
			.on('mouseenter', function () {
				$(this).css('transition-duration', 0);
			});
	}

	return module;
});
