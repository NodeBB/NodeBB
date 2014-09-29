"use strict";
/* global define, app, socket */

define('forum/admin/appearance/skins', function() {
	var Skins = {};
	
	Skins.init = function() {
		var scriptEl = $('<script />');
		scriptEl.attr('src', '//bootswatch.aws.af.cm/3/?callback=bootswatchListener');
		$('body').append(scriptEl);

		$('#bootstrap_themes').on('click', function(e){
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
			})
		}, function(html) {
			themeContainer.html(html);
		});
	};

	function highlightSelectedTheme(themeId) {
		$('.themes li[data-theme]').removeClass('btn-warning');
		$('.themes li[data-theme="' + themeId + '"]').addClass('btn-warning');
	}

	return Skins;
});
