"use strict";
/* global define, app, ajaxify, socket, templates, bootbox */

define('admin/general/navigation', function() {
	var navigation = {};


	var available;

	navigation.init = function() {
		available = JSON.parse(ajaxify.variables.get('available'));

		$('.delete').on('click', function() {
			$(this).parents('li').remove();
		});

		$('#save').on('click', saveNavigation);
	};

	function saveNavigation() {
		var nav = [];

		$('#enabled li').each(function() {
			var form = $(this).find('form').serializeArray(),
				data = {};

			form.forEach(function(input) {
				data[input.name] = input.value;
			});

			nav.push(data);
		});

		socket.emit('admin.navigation.save', activeRewards, function(err) {
			if (err) {
				app.alertError(err.message);
			} else {
				app.alertSuccess('Successfully saved navigation');
			}
		});
	}

	return navigation;
});