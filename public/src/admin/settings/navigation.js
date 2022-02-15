'use strict';


define('admin/settings/navigation', [
	'translator',
	'iconSelect',
	'benchpress',
	'alerts',
	'jquery-ui/ui/widgets/draggable',
	'jquery-ui/ui/widgets/droppable',
	'jquery-ui/ui/widgets/sortable',
], function (translator, iconSelect, Benchpress, alerts) {
	const navigation = {};
	let available;

	navigation.init = function () {
		available = ajaxify.data.available;

		$('#available').find('li .drag-item').draggable({
			connectToSortable: '#active-navigation',
			helper: 'clone',
			distance: 10,
			stop: drop,
		});

		$('#active-navigation').sortable().droppable({
			accept: $('#available li .drag-item'),
		});

		$('#enabled').on('click', '.iconPicker', function () {
			const iconEl = $(this).find('i');
			iconSelect.init(iconEl, function (el) {
				const newIconClass = el.attr('value');
				const index = iconEl.parents('[data-index]').attr('data-index');
				$('#active-navigation [data-index="' + index + '"] i.nav-icon').attr('class', 'fa fa-fw ' + newIconClass);
				iconEl.siblings('[name="iconClass"]').val(newIconClass);
				iconEl.siblings('.change-icon-link').toggleClass('hidden', !!newIconClass);
			});
		});

		$('#enabled').on('click', '[name="dropdown"]', function () {
			const el = $(this);
			const index = el.parents('[data-index]').attr('data-index');
			$('#active-navigation [data-index="' + index + '"] i.dropdown-icon').toggleClass('hidden', !el.is(':checked'));
		});

		$('#active-navigation').on('click', 'li', onSelect);

		$('#enabled')
			.on('click', '.delete', remove)
			.on('click', '.toggle', toggle);

		$('#save').on('click', save);
	};

	function onSelect() {
		const clickedIndex = $(this).attr('data-index');
		$('#active-navigation li').removeClass('active');
		$(this).addClass('active');

		const detailsForm = $('#enabled').children('[data-index="' + clickedIndex + '"]');
		$('#enabled li').addClass('hidden');

		if (detailsForm.length) {
			detailsForm.removeClass('hidden');
		}
		return false;
	}

	function drop(ev, ui) {
		const id = ui.helper.attr('data-id');
		const el = $('#active-navigation [data-id="' + id + '"]');
		const data = id === 'custom' ? { iconClass: 'fa-navicon', groups: available[0].groups } : available[id];

		data.enabled = false;
		data.index = (parseInt($('#enabled').children().last().attr('data-index'), 10) || 0) + 1;
		data.title = translator.escape(data.title);
		data.text = translator.escape(data.text);
		data.groups = ajaxify.data.groups;
		Benchpress.parse('admin/settings/navigation', 'navigation', { navigation: [data] }, function (li) {
			translator.translate(li, function (li) {
				li = $(translator.unescape(li));
				el.after(li);
				el.remove();
			});
		});
		Benchpress.parse('admin/settings/navigation', 'enabled', { enabled: [data] }, function (li) {
			translator.translate(li, function (li) {
				li = $(translator.unescape(li));
				$('#enabled').append(li);
				componentHandler.upgradeDom();
			});
		});
	}

	function save() {
		const nav = [];

		const indices = [];
		$('#active-navigation li').each(function () {
			indices.push($(this).attr('data-index'));
		});

		indices.forEach(function (index) {
			const el = $('#enabled').children('[data-index="' + index + '"]');
			const form = el.find('form').serializeArray();
			const data = {};

			form.forEach(function (input) {
				if (data[input.name]) {
					if (!Array.isArray(data[input.name])) {
						data[input.name] = [
							data[input.name],
						];
					}
					data[input.name].push(input.value);
				} else {
					data[input.name] = input.value;
				}
			});

			nav.push(data);
		});

		socket.emit('admin.navigation.save', nav, function (err) {
			if (err) {
				alerts.error(err);
			} else {
				alerts.success('Successfully saved navigation');
			}
		});
	}

	function remove() {
		const index = $(this).parents('[data-index]').attr('data-index');
		$('#active-navigation [data-index="' + index + '"]').remove();
		$('#enabled [data-index="' + index + '"]').remove();
		return false;
	}

	function toggle() {
		const btn = $(this);
		const disabled = btn.hasClass('btn-success');
		translator.translate(disabled ? '[[admin/settings/navigation:btn.disable]]' : '[[admin/settings/navigation:btn.enable]]', function (html) {
			btn.toggleClass('btn-warning').toggleClass('btn-success').html(html);
			btn.parents('li').find('[name="enabled"]').val(disabled ? 'on' : '');
		});
		return false;
	}

	return navigation;
});
