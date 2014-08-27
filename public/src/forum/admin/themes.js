"use strict";
/*global define, socket, app, bootbox, tabIndent, config, RELATIVE_PATH, templates */

define('forum/admin/themes', ['forum/admin/settings'], function(Settings) {
	var Themes = {};

	function highlightSelectedTheme(themeId) {
		$('.themes li[data-theme]').removeClass('btn-warning');
		$('.themes li[data-theme="' + themeId + '"]').addClass('btn-warning');
	}

	Themes.init = function() {
		var scriptEl = $('<script />');
		scriptEl.attr('src', '//bootswatch.aws.af.cm/3/?callback=bootswatchListener');
		$('body').append(scriptEl);

		$('#widgets .nav-pills a').on('click', function(ev) {
			var $this = $(this);
			$('#widgets .nav-pills li').removeClass('active');
			$this.parent().addClass('active');

			$('#widgets .tab-pane').removeClass('active');
			$('#widgets .tab-pane[data-template="' + $this.attr('data-template') + '"]').addClass('active');

			ev.preventDefault();
			return false;
		});

		var bootstrapThemeContainer = $('#bootstrap_themes'),
			installedThemeContainer = $('#installed_themes');

		function themeEvent(e) {
			var target = $(e.target),
				action = target.attr('data-action');

			if (action && action === 'use') {
				var parentEl = target.parents('li'),
					themeType = parentEl.attr('data-type'),
					cssSrc = parentEl.attr('data-css'),
					themeId = parentEl.attr('data-theme');

				socket.emit('admin.themes.set', {
					type: themeType,
					id: themeId,
					src: cssSrc
				}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					highlightSelectedTheme(themeId);

					app.alert({
						alert_id: 'admin:theme',
						type: 'info',
						title: 'Theme Changed',
						message: 'Please restart your NodeBB to fully activate this theme',
						timeout: 5000,
						clickfn: function() {
							socket.emit('admin.restart');
						}
					});
				});
			}
		}

		bootstrapThemeContainer.on('click', themeEvent);
		installedThemeContainer.on('click', themeEvent);

		$('#revert_theme').on('click', function() {
			bootbox.confirm('Are you sure you wish to remove the custom theme and restore the NodeBB default theme?', function(confirm) {
				if (confirm) {
					socket.emit('admin.themes.set', {
						type: 'local',
						id: 'nodebb-theme-vanilla'
					}, function(err) {
						if (err) {
							return app.alertError(err.message);
						}
						highlightSelectedTheme('nodebb-theme-vanilla');
						app.alert({
							alert_id: 'admin:theme',
							type: 'success',
							title: 'Theme Changed',
							message: 'You have successfully reverted your NodeBB back to it\'s default theme.',
							timeout: 3500
						});
					});
				}
			});
		});

		// Installed Themes
		socket.emit('admin.themes.getInstalled', function(err, themes) {
			if(err) {
				return app.alertError(err.message);
			}

			var instListEl = $('#installed_themes');

			if (!themes.length) {
				instListEl.append($('<li/ >').addClass('no-themes').html('No installed themes found'));
				return;
			} else {
				templates.parse('partials/admin/theme_list', {
					themes: themes
				}, function(html) {
					instListEl.html(html);
					highlightSelectedTheme(config['theme:id']);
				});
			}
		});

		// Proper tabbing for "Custom CSS" field
		var	customCSSEl = $('textarea[data-field]')[0];
		tabIndent.config.tab = '    ';
		tabIndent.render(customCSSEl);

		Themes.prepareWidgets();

		populateBranding();
		admin.enableColorPicker($('.branding'));
		Settings.prepare();
	};

	Themes.render = function(bootswatch) {
		var themeContainer = $('#bootstrap_themes');

		templates.parse('partials/admin/theme_list', {
			themes: bootswatch.themes.map(function(theme) {
				return {
					type: 'bootswatch',
					id: theme.name,
					name: theme.name,
					description: theme.description,
					screenshot_url: theme.thumbnail,
					url: theme.preview,
					css: theme.cssCdn
				};
			})
		}, function(html) {
			themeContainer.html(html);
		});
	};

	Themes.prepareWidgets = function() {
		$('[data-location="drafts"]').insertAfter($('[data-location="drafts"]').closest('.tab-content'));

		$('#widgets .available-widgets .panel').draggable({
			helper: function(e) {
				return $(e.target).parents('.panel').clone().addClass('block').width($(e.target.parentNode).width());
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
			$(this).parents('.panel').children('.panel-body').toggleClass('hidden');
		}).on('click', '.delete-widget', function() {
			var panel = $(this).parents('.panel');

			bootbox.confirm('Are you sure you wish to delete this widget?', function(confirm) {
				if (confirm) {
					panel.remove();
				}
			});
		}).on('dblclick', '.panel-heading', function() {
			$(this).parents('.panel').children('.panel-body').toggleClass('hidden');
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

				area.find('.panel[data-widget]').each(function() {
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

		$.get(RELATIVE_PATH + '/api/admin/themes', function(data) {
			var areas = data.areas;

			for(var i=0; i<areas.length; ++i) {
				var area = areas[i],
					widgetArea = $('#widgets .area[data-template="' + area.template + '"][data-location="' + area.location + '"]').find('.widget-area');

				widgetArea.html('');

				for (var k=0; k<area.data.length; ++k) {
					var widgetData = area.data[k],
						widgetEl = $('.available-widgets [data-widget="' + widgetData.widget + '"]').clone();

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
	};

	function populateBranding() {
		require(['settings'], function (settings) {
			var wrapper = $('#branding');

			settings.sync('branding', wrapper);

			$('#save-branding').click(function(event) {
				settings.persist('branding', $('#branding'), function() {
					socket.emit('admin.themes.updateBranding');
				});

				event.preventDefault();
			});
		});
	}

	return Themes;
});
