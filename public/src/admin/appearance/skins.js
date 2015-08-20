"use strict";
/* global define, app, socket, templates */

define('admin/appearance/skins', function() {
	var Skins = {};
	
	Skins.init = function() {
		var scriptEl = $('<script />');
		scriptEl.attr('src', '//bootswatch.aws.af.cm/3/?callback=bootswatchListener');
		$('body').append(scriptEl);

		$('#skins').on('click', function(e){
			var target = $(e.target),
				action = target.attr('data-action');

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
					css: theme.cssCdn
				};
			}),
			showRevert: true
		}, function(html) {
			themeContainer.html(html);
		});
	};

	function highlightSelectedTheme(themeId) {
		$('.themes li[data-theme]').removeClass('selected').find('[data-action="use"]').html('Use Theme').removeClass('btn-success').addClass('btn-primary');
		$('.themes li[data-theme="' + themeId + '"]').addClass('selected').find('[data-action="use"]').html('Current Theme').removeClass('btn-primary').addClass('btn-success');
	}

	return Skins;
});
