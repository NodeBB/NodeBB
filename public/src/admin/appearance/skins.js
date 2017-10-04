'use strict';


define('admin/appearance/skins', ['translator', 'benchpress'], function (translator, Benchpress) {
	var Skins = {};

	Skins.init = function () {
		// Populate skins from Bootswatch API
		$.ajax({
			method: 'get',
			url: 'https://bootswatch.com/api/3.json',
		}).done(Skins.render);

		$('#skins').on('click', function (e) {
			var target = $(e.target);

			if (!target.attr('data-action')) {
				target = target.parents('[data-action]');
			}

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
					highlightSelectedTheme(themeId);

					app.alert({
						alert_id: 'admin:theme',
						type: 'info',
						title: '[[admin/appearance/skins:skin-updated]]',
						message: themeId ? ('[[admin/appearance/skins:applied-success, ' + themeId + ']]') : '[[admin/appearance/skins:revert-success]]',
						timeout: 5000,
					});
				});
			}
		});
	};

	Skins.render = function (bootswatch) {
		var themeContainer = $('#bootstrap_themes');

		Benchpress.parse('admin/partials/theme_list', {
			themes: bootswatch.themes.map(function (theme) {
				return {
					type: 'bootswatch',
					id: theme.name,
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
			translator.translate(html, function (html) {
				themeContainer.html(html);

				if (config['theme:src']) {
					var skin = config['theme:src']
						.match(/latest\/(\S+)\/bootstrap.min.css/)[1]
						.replace(/(^|\s)([a-z])/g, function (m, p1, p2) { return p1 + p2.toUpperCase(); });

					highlightSelectedTheme(skin);
				}
			});
		});
	};

	function highlightSelectedTheme(themeId) {
		translator.translate('[[admin/appearance/skins:select-skin]]  ||  [[admin/appearance/skins:current-skin]]', function (text) {
			text = text.split('  ||  ');
			var select = text[0];
			var current = text[1];

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
