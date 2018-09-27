'use strict';


define('admin/general/navigation', ['translator', 'iconSelect', 'benchpress', 'jqueryui'], function (translator, iconSelect, Benchpress) {
	var navigation = {};
	var available;

	navigation.init = function () {
		available = ajaxify.data.available;

		$('#enabled .unescape').each(function () {
			$(this).val(translator.unescape($(this).val()));
		});

		translator.translate($('#available').html(), function (html) {
			$('#available').html(translator.unescape(html))
				.find('li .drag-item').draggable({
					connectToSortable: '#active-navigation',
					helper: 'clone',
					distance: 10,
					stop: drop,
				});
		});

		$('#active-navigation').sortable().droppable({
			accept: $('#available li .drag-item'),
		});

		$('#enabled').on('click', '.iconPicker', function () {
			var iconEl = $(this).find('i');
			iconSelect.init(iconEl, function (el) {
				var newIconClass = el.attr('value');
				var index = iconEl.parents('[data-index]').attr('data-index');
				$('#active-navigation [data-index="' + index + '"] i').attr('class', 'fa fa-fw ' + newIconClass);
				iconEl.siblings('[name="iconClass"]').val(newIconClass);
				iconEl.siblings('.change-icon-link').toggleClass('hidden', !!newIconClass);
			});
		});

		$('#active-navigation').on('click', 'li', onSelect);

		$('#enabled')
			.on('click', '.delete', remove)
			.on('click', '.toggle', toggle);

		$('#save').on('click', save);
	};

	function onSelect() {
		var clickedIndex = $(this).attr('data-index');
		$('#active-navigation li').removeClass('active');
		$(this).addClass('active');

		var detailsForm = $('#enabled').children('[data-index="' + clickedIndex + '"]');
		$('#enabled li').addClass('hidden');

		if (detailsForm.length) {
			detailsForm.removeClass('hidden');
		}
		return false;
	}

	function drop(ev, ui) {
		var id = ui.helper.attr('data-id');
		var el = $('#active-navigation [data-id="' + id + '"]');
		var data = id === 'custom' ? { iconClass: 'fa-navicon' } : available[id];

		data.enabled = false;
		data.index = (parseInt($('#enabled').children().last().attr('data-index'), 10) || 0) + 1;
		data.title = translator.escape(data.title);
		data.text = translator.escape(data.text);
		Benchpress.parse('admin/general/navigation', 'navigation', { navigation: [data] }, function (li) {
			translator.translate(li, function (li) {
				li = $(translator.unescape(li));
				el.after(li);
				el.remove();
			});
		});

		Benchpress.parse('admin/general/navigation', 'enabled', { enabled: [data] }, function (li) {
			translator.translate(li, function (li) {
				li = $(translator.unescape(li));
				$('#enabled').append(li);
				componentHandler.upgradeDom();
			});
		});
	}

	function save() {
		var nav = [];

		var indices = [];
		$('#active-navigation li').each(function () {
			indices.push($(this).attr('data-index'));
		});

		indices.forEach(function (index) {
			var el = $('#enabled').children('[data-index="' + index + '"]');
			var form = el.find('form').serializeArray();
			var data = {};
			var properties = {};

			form.forEach(function (input) {
				if (input.name.slice(0, 9) === 'property:' && input.value === 'on') {
					properties[input.name.slice(9)] = true;
				} else {
					data[input.name] = translator.escape(input.value);
				}
			});

			data.properties = {};

			for (var prop in properties) {
				if (properties.hasOwnProperty(prop)) {
					data.properties[prop] = properties[prop];
				}
			}

			nav.push(data);
		});

		socket.emit('admin.navigation.save', nav, function (err) {
			if (err) {
				app.alertError(err.message);
			} else {
				app.alertSuccess('Successfully saved navigation');
			}
		});
	}

	function remove() {
		var index = $(this).parents('[data-index]').attr('data-index');
		$('#active-navigation [data-index="' + index + '"]').remove();
		$('#enabled [data-index="' + index + '"]').remove();
		return false;
	}

	function toggle() {
		var btn = $(this);
		var disabled = btn.hasClass('btn-success');
		translator.translate(disabled ? '[[admin/general/navigation:btn.disable]]' : '[[admin/general/navigation:btn.enable]]', function (html) {
			btn.toggleClass('btn-warning').toggleClass('btn-success').html(html);
			btn.parents('li').find('[name="enabled"]').val(disabled ? 'on' : '');
		});
		return false;
	}

	return navigation;
});
