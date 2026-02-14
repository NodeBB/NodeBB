'use strict';

define('admin/advanced/cache', ['alerts'], function (alerts) {
	const Cache = {};
	Cache.init = function () {
		require(['admin/settings'], function (Settings) {
			Settings.prepare();
		});

		$('.clear').on('click', function () {
			const name = $(this).attr('data-name');
			socket.emit('admin.cache.clear', { name: name }, function (err) {
				if (err) {
					return alerts.error(err);
				}
				ajaxify.refresh();
			});
		});

		$('.form-check').on('change', function () {
			const input = $(this).find('input');
			const flag = input.is(':checked');
			const name = $(this).attr('data-name');
			socket.emit('admin.cache.toggle', { name: name, enabled: flag }, function (err) {
				if (err) {
					return alerts.error(err);
				}
			});
		});

		$(document).on('click', '#cache-table th', function () {
			const table = $(this).closest('table');
			const tbody = table.find('tbody');
			const columnIndex = $(this).index();

			const rows = tbody.find('tr').toArray();

			// Toggle sort direction
			const ascending = !!$(this).data('asc');
			$(this).data('asc', !ascending);

			// Remove sort indicators from all headers
			table.find('th i').addClass('invisible');

			$(this).find('i').removeClass('invisible')
				.toggleClass('fa-sort-up', ascending)
				.toggleClass('fa-sort-down', !ascending);

			rows.sort(function (a, b) {
				const A = $(a).children().eq(columnIndex).attr('data-sort-value').trim();
				const B = $(b).children().eq(columnIndex).attr('data-sort-value').trim();
				// Remove thousands separators
				const cleanA = A.replace(/,/g, '');
				const cleanB = B.replace(/,/g, '');

				const numA = parseFloat(cleanA);
				const numB = parseFloat(cleanB);

				if (!isNaN(numA) && !isNaN(numB)) {
					return ascending ? numA - numB : numB - numA;
				}

				return ascending ?
					A.localeCompare(B) :
					B.localeCompare(A);
			});

			tbody.append(rows);
		});
	};
	return Cache;
});
