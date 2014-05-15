'use strict';
/* globals define, translator, templates */

define(function() {

	var module = {};

	// use unique alert_id to have multiple alerts visible at a time, use the same alert_id to fade out the current instance
	// type : error, success, info, warning/notify
	// title = bolded title text
	// message = alert message content
	// timeout default = permanent
	// location : alert_window (default) or content
	module.alert = function (params) {
		var alert_id = 'alert_button_' + ((params.alert_id) ? params.alert_id : new Date().getTime());

		var alert = $('#' + alert_id);
		var title = params.title || '';

		function fadeOut() {
			alert.fadeOut(500, function () {
				$(this).remove();
			});
		}

		function startTimeout(timeout) {
			var timeoutId = setTimeout(function () {
				fadeOut();
			}, timeout);

			alert.attr('timeoutId', timeoutId);
		}

		if (alert.length) {
			alert.find('strong').html(title);
			alert.find('p').html(params.message);
			alert.attr('class', 'alert alert-dismissable alert-' + params.type);

			clearTimeout(alert.attr('timeoutId'));
			startTimeout(params.timeout);

			alert.children().fadeOut('100');
			translator.translate(templates.parse(alert.html(), {}), function(translatedHTML) {
				alert.children().fadeIn('100');
				alert.html(translatedHTML);
			});
		} else {
			alert = $('<div id="' + alert_id + '" class="alert alert-dismissable alert-' + params.type +'"></div>');

			alert.append($('<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>'))
				.append($('<strong>' + title + '</strong>'));

			if (params.message) {
				alert.append($('<p>' + params.message + '</p>'));
			}

			if (!params.location) {
				params.location = 'alert_window';
			}

			translator.translate(templates.parse(alert.html(), {}), function(translatedHTML) {
				alert.html(translatedHTML);
				$('#' + params.location).prepend(alert.fadeIn('100'));

				if(typeof params.closefn === 'function') {
					alert.find('button').on('click', function() {
						params.closefn();
						fadeOut();
						return false;
					});
				}
			});

			if (params.timeout) {
				startTimeout(params.timeout);
			}

			if (typeof params.clickfn === 'function') {
				alert.on('click', function (e) {
					if(!$(e.target).is('.close')) {
						params.clickfn();
					}
					fadeOut();
				});
			}
		}
	};

	module.remove = function(id) {
		$('#alert_button_' + id).remove();
	};

	return module;
});
