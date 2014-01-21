define(function() {
	var Themes = {};

	Themes.init = function() {
		var scriptEl = document.createElement('script');
		scriptEl.src = 'http://api.bootswatch.com/3/?callback=bootswatchListener';
		document.body.appendChild(scriptEl);

		var bootstrapThemeContainer = document.querySelector('#bootstrap_themes'),
			installedThemeContainer = document.querySelector('#installed_themes'),
			themeEvent = function(e) {
				if (e.target.hasAttribute('data-action')) {
					switch (e.target.getAttribute('data-action')) {
						case 'use':
							var parentEl = $(e.target).parents('li'),
								themeType = parentEl.attr('data-type'),
								cssSrc = parentEl.attr('data-css'),
								themeId = parentEl.attr('data-theme');

							socket.emit('admin.themes.set', {
								type: themeType,
								id: themeId,
								src: cssSrc
							}, function(err) {
								app.alert({
									alert_id: 'admin:theme',
									type: 'success',
									title: 'Theme Changed',
									message: 'You have successfully changed your NodeBB\'s theme. Please restart to see the changes.',
									timeout: 2500
								});
							});
						break;
					}
				}
			};

		bootstrapThemeContainer.addEventListener('click', themeEvent);
		installedThemeContainer.addEventListener('click', themeEvent);

		var revertEl = document.getElementById('revert_theme');
		revertEl.addEventListener('click', function() {
			bootbox.confirm('Are you sure you wish to remove the custom theme and restore the NodeBB default theme?', function(confirm) {
				if (confirm) {
					socket.emit('admin.themes.set', {
						type: 'local',
						id: 'nodebb-theme-cerulean'
					}, function(err) {
						app.alert({
							alert_id: 'admin:theme',
							type: 'success',
							title: 'Theme Changed',
							message: 'You have successfully reverted your NodeBB back to it\'s default theme. Please restart to see the changes.',
							timeout: 3500
						});
					});
				}
			});
		}, false);

		// Installed Themes
		socket.emit('admin.themes.getInstalled', function(err, themes) {
			if(err) {
				return app.alertError(err.message);
			}

			var instListEl = document.getElementById('installed_themes'),
				themeFrag = document.createDocumentFragment(),
				liEl = document.createElement('li');
				liEl.setAttribute('data-type', 'local');

			if (themes.length > 0) {
				for (var x = 0, numThemes = themes.length; x < numThemes; x++) {
					liEl.setAttribute('data-theme', themes[x].id);
					liEl.innerHTML = '<img src="' + (themes[x].screenshot ? '/css/previews/' + themes[x].id : RELATIVE_PATH + '/images/themes/default.png') + '" />' +
						'<div>' +
						'<div class="pull-right">' +
						'<button class="btn btn-primary" data-action="use">Use</button> ' +
						'</div>' +
						'<h4>' + themes[x].name + '</h4>' +
						'<p>' +
						themes[x].description +
						(themes[x].url ? ' (<a href="' + themes[x].url + '">Homepage</a>)' : '') +
						'</p>' +
						'</div>' +
						'<div class="clear">';
					themeFrag.appendChild(liEl.cloneNode(true));
				}
			} else {
				// No themes found
				liEl.className = 'no-themes';
				liEl.innerHTML = 'No installed themes found';
				themeFrag.appendChild(liEl);
			}

			instListEl.innerHTML = '';
			instListEl.appendChild(themeFrag);
		});
	}

	Themes.render = function(bootswatch) {
		var themeFrag = document.createDocumentFragment(),
			themeEl = document.createElement('li'),
			themeContainer = document.querySelector('#bootstrap_themes'),
			numThemes = bootswatch.themes.length;

		themeEl.setAttribute('data-type', 'bootswatch');

		for (var x = 0; x < numThemes; x++) {
			var theme = bootswatch.themes[x];
			themeEl.setAttribute('data-css', theme.cssCdn);
			themeEl.setAttribute('data-theme', theme.name);
			themeEl.innerHTML = '<img src="' + theme.thumbnail + '" />' +
				'<div>' +
				'<div class="pull-right">' +
				'<button class="btn btn-primary" data-action="use">Use</button> ' +
				'</div>' +
				'<h4>' + theme.name + '</h4>' +
				'<p>' + theme.description + '</p>' +
				'</div>' +
				'<div class="clear">';
			themeFrag.appendChild(themeEl.cloneNode(true));
		}
		themeContainer.innerHTML = '';
		themeContainer.appendChild(themeFrag);
	}

	return Themes;
});