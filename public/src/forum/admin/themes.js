var nodebb_admin = (function(nodebb_admin) {

	var themes = {};

	themes.render = function(bootswatch) {
		var themeFrag = document.createDocumentFragment(),
			themeEl = document.createElement('li'),
			themeContainer = document.querySelector('#bootstrap_themes'),
			numThemes = bootswatch.themes.length;

		for (var x = 0; x < numThemes; x++) {
			var theme = bootswatch.themes[x];
			themeEl.setAttribute('data-css', theme.cssMin);
			themeEl.setAttribute('data-theme', theme.name);
			themeEl.innerHTML = '<img src="' + theme.thumbnail + '" />' +
				'<div>' +
				'<div class="pull-right">' +
				'<button class="btn btn-primary" data-action="use">Use</button> ' +
				'<button class="btn btn-default" data-action="preview">Preview</button>' +
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

	nodebb_admin.themes = themes;

	return nodebb_admin;

}(nodebb_admin || {}));


(function() {
	var scriptEl = document.createElement('script');
	scriptEl.src = 'http://api.bootswatch.com/3/?callback=nodebb_admin.themes.render';
	document.body.appendChild(scriptEl);

	var bootstrapThemeContainer = document.querySelector('#bootstrap_themes'),
		installedThemeContainer = document.querySelector('#installed_themes'),
		themeEvent = function(e) {
			if (e.target.hasAttribute('data-action')) {
				switch (e.target.getAttribute('data-action')) {
					case 'preview':
						var cssSrc = $(e.target).parents('li').attr('data-css'),
							cssEl = document.getElementById('base-theme');

						cssEl.href = cssSrc;
						break;
					case 'use':
						var parentEl = $(e.target).parents('li'),
							cssSrc = parentEl.attr('data-css'),
							cssName = parentEl.attr('data-theme');
						socket.emit('api:config.set', {
							key: 'theme:id',
							value: 'bootswatch:' + cssName
						});
						socket.emit('api:config.set', {
							key: 'theme:src',
							value: cssSrc
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
				nodebb_admin.remove('theme:id');
				nodebb_admin.remove('theme:src');
			}
		});
	}, false);

	// Installed Themes
	socket.emit('api:admin.themes.getInstalled', function(themes) {
		var instListEl = document.getElementById('installed_themes'),
			themeFrag = document.createDocumentFragment(),
			liEl = document.createElement('li');

		if (themes.length > 0) {
			for (var x = 0, numThemes = themes.length; x < numThemes; x++) {
				liEl.setAttribute('data-theme', themes[x].id);
				liEl.setAttribute('data-css', themes[x].src);
				liEl.innerHTML = '<img src="' + themes[x].screenshot + '" />' +
					'<div>' +
					'<div class="pull-right">' +
					'<button class="btn btn-primary" data-action="use">Use</button> ' +
					'<button class="btn btn-default" data-action="preview">Preview</button>' +
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
})();