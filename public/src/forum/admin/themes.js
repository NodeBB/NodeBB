nodebb_admin.themes = {
	render: function(bootswatch) {
		var	themeFrag = document.createDocumentFragment(),
			themeEl = document.createElement('li'),
			themeContainer = document.querySelector('#content .themes'),
			numThemes = bootswatch.themes.length;

		for(var x=0;x<numThemes;x++) {
			var theme = bootswatch.themes[x];
			themeEl.setAttribute('data-css', theme.cssMin);
			themeEl.setAttribute('data-theme', theme.name);
			themeEl.innerHTML =	'<img src="' + theme.thumbnail + '" />' +
								'<div>' +
									'<div class="pull-right">' +
										'<button class="btn btn-primary" data-action="use">Use</button> ' +
										'<button class="btn" data-action="preview">Preview</button>' +
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
};

(function() {
	var	scriptEl = document.createElement('script');
	scriptEl.src = 'http://api.bootswatch.com?callback=nodebb_admin.themes.render';
	document.body.appendChild(scriptEl);

	var themeContainer = document.querySelector('#content .themes');
	themeContainer.addEventListener('click', function(e) {
		if (e.target.hasAttribute('data-action')) {
			switch(e.target.getAttribute('data-action')) {
				case 'preview':
					var	cssSrc = $(e.target).parents('li').attr('data-css'),
						cssEl = document.getElementById('base-theme');

					cssEl.href = cssSrc;
				break;
				case 'use':
					var	parentEl = $(e.target).parents('li'),
						cssSrc = parentEl.attr('data-css'),
						cssName = parentEl.attr('data-theme');
					socket.emit('api:config.set', {
						key: 'theme:id', value: 'bootswatch:' + cssName
					});
					socket.emit('api:config.set', {
						key: 'theme:src', value: cssSrc
					});
				break;
			}
		}
	}, false);

	var revertEl = document.getElementById('revert_theme');
	revertEl.addEventListener('click', function() {
		bootbox.confirm('Are you sure you wish to remove the custom theme and restore the NodeBB default theme?', function(confirm) {
			if (confirm) {
				nodebb_admin.remove('theme:id');
				nodebb_admin.remove('theme:src');
			}
		});
	}, false);
})();