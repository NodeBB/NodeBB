"use strict";
/* global define, app, socket, templates */

define('admin/appearance/skins', function() {
	var Skins = {};
	
	Skins.init = function() {
		// Populate skins from Bootswatch API
		$.ajax({
			method: 'get',
			url: 'https://bootswatch.com/api/3.json'
		}).done(Skins.render);

		$('#skins').on('click', function(e){
			var target = $(e.target);

			if (!target.attr('data-action')) {
				target = target.parents('[data-action]');
			}

			var action = target.attr('data-action');

			if (action && action === 'use') {
				var parentEl = target.parents('[data-theme]'),
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
						title: 'Skin Updated',
						message: themeId ? (themeId + ' skin was successfully applied') : 'Skin reverted to base colours',
						timeout: 5000
					});
				});
			}
		});
	};

	Skins.render = function(bootswatch) {
		var themeContainer = $('#bootstrap_themes');

		templates.parse('admin/partials/theme_list', {
			themes: bootswatch.themes.map(function(theme) {
				return {
					type: 'bootswatch',
					id: theme.name,
					name: theme.name,
					description: theme.description,
					screenshot_url: theme.thumbnail,
					url: theme.preview,
					css: theme.cssCdn,
					skin: true
				};
			}),
			showRevert: true
		}, function(html) {
			themeContainer.html(html);

			if (config['theme:src']) {
				var skin = config['theme:src']
					.match(/latest\/(\S+)\/bootstrap.min.css/)[1]
					.replace(/(^|\s)([a-z])/g , function(m,p1,p2){return p1+p2.toUpperCase();});

				highlightSelectedTheme(skin);
			}
		});
	};

	function highlightSelectedTheme(themeId) {
		$('[data-theme]')
			.removeClass('selected')
			.find('[data-action="use"]').each(function() {
				if ($(this).parents('[data-theme]').attr('data-theme')) {
					$(this)
						.html('Select Skin')
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
				.html('Current Skin')
				.removeClass('btn-primary')
				.addClass('btn-success');
	}

	return Skins;
});
