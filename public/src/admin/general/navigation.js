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

		$('.toggle').on('click', function() {
			var btn = $(this),
				disabled = btn.html() === 'Enable';

			btn.toggleClass('btn-warning').toggleClass('btn-success').html(!disabled ? 'Enable' : 'Disable');
			btn.parents('li').find('[name="enabled"]').val(disabled);
			return false;
		});

		$('#save').on('click', saveNavigation);

		$('#enabled').sortable();
		$('#enabled').disableSelection();
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

		socket.emit('admin.navigation.save', nav, function(err) {
			if (err) {
				app.alertError(err.message);
			} else {
				app.alertSuccess('Successfully saved navigation');
			}
		});
	}

	return navigation;
});