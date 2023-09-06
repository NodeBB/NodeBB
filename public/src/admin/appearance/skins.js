'use strict';


define('admin/appearance/skins', [
	'translator', 'alerts', 'settings', 'hooks', 'slugify',
], function (translator, alerts, settings, hooks, slugify) {
	const Skins = {};

	Skins.init = function () {
		// Populate skins from Bootswatch API
		$.ajax({
			method: 'get',
			url: 'https://bootswatch.com/api/5.json',
		}).done((bsData) => {
			hooks.on('action:settings.sorted-list.loaded', (data) => {
				if (data.hash === 'custom-skins') {
					// slugify all custom-skin ids after load
					$('.custom-skin-settings [data-type="list"] [data-theme]').each((i, el) => {
						$(el).attr('data-theme', slugify($(el).attr('data-theme')));
					});
					highlightSelectedTheme(app.config.bootswatchSkin);
				}
			});
			settings.load('custom-skins', $('.custom-skin-settings'));
			Skins.render(bsData);
		});

		$('#save-custom-skins').on('click', function () {
			settings.save('custom-skins', $('.custom-skin-settings'), function () {
				alerts.success('[[admin/appearance/skins:save-custom-skins-success]]');
			});
			return false;
		});


		$('#skins').on('click', function (e) {
			let target = $(e.target);

			if (!target.attr('data-action')) {
				target = target.parents('[data-action]');
			}

			const action = target.attr('data-action');

			if (action && action === 'use') {
				const parentEl = target.parents('[data-theme]');
				const cssSrc = parentEl.attr('data-css');
				const themeId = parentEl.attr('data-theme');
				const themeName = parentEl.attr('data-theme-name');

				socket.emit('admin.themes.set', {
					type: 'bootswatch',
					id: themeId,
					src: cssSrc,
				}, function (err) {
					if (err) {
						return alerts.error(err);
					}
					highlightSelectedTheme(themeId);

					alerts.alert({
						alert_id: 'admin:theme',
						type: 'info',
						title: '[[admin/appearance/skins:skin-updated]]',
						message: themeId ? ('[[admin/appearance/skins:applied-success, ' + themeName + ']]') : '[[admin/appearance/skins:revert-success]]',
						timeout: 5000,
					});
				});
			}
		});
	};

	Skins.render = function (bootswatch) {
		const themeContainer = $('#bootstrap_themes');

		app.parseAndTranslate('admin/partials/theme_list', {
			themes: bootswatch.themes.map(function (theme) {
				return {
					type: 'bootswatch',
					id: theme.name.toLowerCase(),
					name: theme.name,
					description: theme.description,
					screenshot_url: theme.thumbnail,
					url: theme.preview,
					css: theme.cssCdn,
					skin: true,
				};
			}),
			showRevert: true,
		}, function (html) {
			themeContainer.html(html);

			highlightSelectedTheme(app.config.bootswatchSkin);
		});
	};

	function highlightSelectedTheme(themeId) {
		translator.translate('[[admin/appearance/skins:select-skin]]  ||  [[admin/appearance/skins:current-skin]]', function (text) {
			text = text.split('  ||  ');
			const select = text[0];
			const current = text[1];

			$('[data-theme]')
				.removeClass('selected')
				.find('[data-action="use"]').each(function () {
					if ($(this).parents('[data-theme]').attr('data-theme')) {
						$(this)
							.html(select)
							.removeClass('btn-success')
							.addClass('btn-primary');
					}
				});

			if (!themeId) {
				return;
			}

			$('[data-theme="' + themeId + '"]')
				.addClass('selected')
				.find('[data-action="use"]')
				.html(current)
				.removeClass('btn-primary')
				.addClass('btn-success');
		});
	}

	return Skins;
});
