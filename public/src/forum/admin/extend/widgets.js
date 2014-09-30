"use strict";
/* global define, app, socket */

define('forum/admin/extend/widgets', function() {
	var Widgets = {};
	
	Widgets.init = function() {		
		prepareWidgets();

		$('#widgets .nav-pills a').on('click', function(ev) {
			var $this = $(this);
			$('#widgets .nav-pills li').removeClass('active');
			$this.parent().addClass('active');

			$('#widgets .tab-pane').removeClass('active');
			$('#widgets .tab-pane[data-template="' + $this.attr('data-template') + '"]').addClass('active');

			ev.preventDefault();
			return false;
		});
	};

	function prepareWidgets() {
		$('[data-location="drafts"]').insertAfter($('[data-location="drafts"]').closest('.tab-content'));

		$('#widgets .available-widgets .widget-panel').draggable({
			helper: function(e) {
				return $(e.target).parents('.widget-panel').clone().addClass('block').width($(e.target.parentNode).width());
			},
			distance: 10,
			connectToSortable: ".widget-area"
		});

		$('#widgets .available-containers .containers > [data-container-html]').draggable({
			helper: function(e) {
				var target = $(e.target);
				target = target.attr('data-container-html') ? target : target.parents('[data-container-html]');

				return target.clone().addClass('block').width(target.width()).css('opacity', '0.5');
			},
			distance: 10
		});

		function appendToggle(el) {
			if (!el.hasClass('block')) {
				el.addClass('block')
					.droppable({
						accept: '[data-container-html]',
						drop: function(event, ui) {
							var el = $(this);

							el.find('.panel-body .container-html').val(ui.draggable.attr('data-container-html'));
							el.find('.panel-body').removeClass('hidden');
						},
						hoverClass: "panel-info"
					})
					.children('.panel-heading')
					.append('<div class="pull-right pointer"><span class="delete-widget"><i class="fa fa-times-circle"></i></span></div><div class="pull-left pointer"><span class="toggle-widget"><i class="fa fa-chevron-circle-down"></i></span>&nbsp;</div>')
					.children('small').html('');
			}
		}

		$('#widgets .widget-area').sortable({
			update: function (event, ui) {
				appendToggle(ui.item);
			},
			connectWith: "div"
		}).on('click', '.toggle-widget', function() {
			$(this).parents('.widget-panel').children('.panel-body').toggleClass('hidden');
		}).on('click', '.delete-widget', function() {
			var panel = $(this).parents('.widget-panel');

			bootbox.confirm('Are you sure you wish to delete this widget?', function(confirm) {
				if (confirm) {
					panel.remove();
				}
			});
		}).on('dblclick', '.panel-heading', function() {
			$(this).parents('.widget-panel').children('.panel-body').toggleClass('hidden');
		});

		$('#widgets .save').on('click', saveWidgets);

		function saveWidgets() {
			var total = $('#widgets [data-template][data-location]').length;

			$('#widgets [data-template][data-location]').each(function(i, el) {
				el = $(el);

				var template = el.attr('data-template'),
					location = el.attr('data-location'),
					area = el.children('.widget-area'),
					widgets = [];

				area.find('.widget-panel[data-widget]').each(function() {
					var widgetData = {},
						data = $(this).find('form').serializeArray();

					for (var d in data) {
						if (data.hasOwnProperty(d)) {
							if (data[d].name) {
								widgetData[data[d].name] = data[d].value;
							}
						}
					}

					widgets.push({
						widget: $(this).attr('data-widget'),
						data: widgetData
					});
				});

				socket.emit('admin.widgets.set', {
					template: template,
					location: location,
					widgets: widgets
				}, function(err) {
					total--;

					if (err) {
						app.alertError(err.message);
					}

					if (total === 0) {
						app.alert({
							alert_id: 'admin:widgets',
							type: 'success',
							title: 'Widgets Updated',
							message: 'Successfully updated widgets',
							timeout: 2500
						});
					}

				});
			});
		}

		function populateWidget(widget, data) {
			if (data.title) {
				var title = widget.find('.panel-heading strong');
				title.text(title.text() + ' - ' + data.title);
			}

			widget.find('input, textarea').each(function() {
				var input = $(this),
					value = data[input.attr('name')];

				if (this.type === 'checkbox') {
					input.attr('checked', !!value);
				} else {
					input.val(value);
				}
			});

			return widget;
		}

		$.get(RELATIVE_PATH + '/api/admin/extend/widgets', function(data) {
			var areas = data.areas;

			for(var i=0; i<areas.length; ++i) {
				var area = areas[i],
					widgetArea = $('#widgets .area[data-template="' + area.template + '"][data-location="' + area.location + '"]').find('.widget-area');

				widgetArea.html('');

				for (var k=0; k<area.data.length; ++k) {
					var widgetData = area.data[k],
						widgetEl = $('.available-widgets [data-widget="' + widgetData.widget + '"]').clone(true);

					widgetArea.append(populateWidget(widgetEl, widgetData.data));
					appendToggle(widgetEl);
				}
			}
		});

		$('.color-selector').on('click', '.btn', function() {
			var btn = $(this),
				selector = btn.parents('.color-selector'),
				container = selector.parents('[data-container-html]'),
				classList = [];

			selector.children().each(function() {
				classList.push($(this).attr('data-class'));
			});

			container
				.removeClass(classList.join(' '))
				.addClass(btn.attr('data-class'));

			container.attr('data-container-html', container.attr('data-container-html')
				.replace(/class="[a-zA-Z0-9-\s]+"/, 'class="' + container[0].className.replace(' pointer ui-draggable', '') + '"')
			);
		});
	}

	return Widgets;
});
