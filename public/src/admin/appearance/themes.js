'use strict';


define('admin/appearance/themes', ['translator', 'benchpress'], function (translator, Benchpress) {
	var Themes = {};

	Themes.init = function () {
		$('#installed_themes').on('click', function (e) {
			var target = $(e.target);
			var action = target.attr('data-action');

			if (action && action === 'use') {
				var parentEl = target.parents('[data-theme]');
				var themeType = parentEl.attr('data-type');
				var cssSrc = parentEl.attr('data-css');
				var themeId = parentEl.attr('data-theme');

				socket.emit('admin.themes.set', {
					type: themeType,
					id: themeId,
					src: cssSrc,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					config['theme:id'] = themeId;
					highlightSelectedTheme(themeId);

					app.alert({
						alert_id: 'admin:theme',
						type: 'info',
						title: '[[admin/appearance/themes:theme-changed]]',
						message: '[[admin/appearance/themes:restart-to-activate]]',
						timeout: 5000,
						clickfn: function () {
							require(['admin/modules/instance'], function (instance) {
								instance.rebuildAndRestart();
							});
						},
					});
				});
			}
		});

		$('#revert_theme').on('click', function () {
			bootbox.confirm('[[admin/appearance/themes:revert-confirm]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.themes.set', {
						type: 'local',
						id: 'nodebb-theme-persona',
					}, function (err) {
						if (err) {
							return app.alertError(err.message);
						}
						highlightSelectedTheme('nodebb-theme-persona');
						app.alert({
							alert_id: 'admin:theme',
							type: 'success',
							title: '[[admin/appearance/themes:theme-changed]]',
							message: '[[admin/appearance/themes:revert-success]]',
							timeout: 3500,
						});
					});
				}
			});
		});

		socket.emit('admin.themes.getInstalled', function (err, themes) {
			if (err) {
				return app.alertError(err.message);
			}

			var instListEl = $('#installed_themes');

			if (!themes.length) {
				instListEl.append($('<li/ >').addClass('no-themes').translateHtml('[[admin/appearance/themes:no-themes]]'));
			} else {
				Benchpress.parse('admin/partials/theme_list', {
					themes: themes,
				}, function (html) {
					translator.translate(html, function (html) {
						instListEl.html(html);
						highlightSelectedTheme(config['theme:id']);
					});
				});
			}
		});
	};

	function highlightSelectedTheme(themeId) {
		translator.translate('[[admin/appearance/themes:select-theme]]  ||  [[admin/appearance/themes:current-theme]]', function (text) {
			text = text.split('  ||  ');
			var select = text[0];
			var current = text[1];

			$('[data-theme]')
				.removeClass('selected')
				.find('[data-action="use"]')
				.html(select)
				.removeClass('btn-success')
				.addClass('btn-primary');

			$('[data-theme="' + themeId + '"]')
				.addClass('selected')
				.find('[data-action="use"]')
				.html(current)
				.removeClass('btn-primary')
				.addClass('btn-success');
		});
	}

	return Themes;
});
