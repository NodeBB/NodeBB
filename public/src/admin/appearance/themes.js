"use strict";
/* global define, app, socket */

define('forum/admin/appearance/themes', function() {
	var Themes = {};
	
	Themes.init = function() {
		$('#installed_themes').on('click', function(e){
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
				templates.parse('admin/partials/theme_list', {
					themes: themes
				}, function(html) {
					instListEl.html(html);
					highlightSelectedTheme(config['theme:id']);
				});
			}
		});
	};

	function highlightSelectedTheme(themeId) {
		$('.themes li[data-theme]').removeClass('btn-warning');
		$('.themes li[data-theme="' + themeId + '"]').addClass('btn-warning');
	}

	return Themes;
});
