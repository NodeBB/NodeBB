<h1>Themes</h1>
<hr />

<p>
	NodeBB Themes are powered by Bootswatch, a repository containing hundreds of themes built
	with Bootstrap as a base theme.
</p>
<ul class="themes">
	<li><i class="icon-refresh icon-spin"></i> Loading Themes</li>
</ul>

<script>
	nodebb_admin.themes = {
		render: function(bootswatch) {
			console.log(bootswatch);
			var	themeFrag = document.createDocumentFragment(),
				themeEl = document.createElement('li'),
				themeContainer = document.querySelector('#content .themes'),
				numThemes = bootswatch.themes.length;

			for(var x=0;x<numThemes;x++) {
				var theme = bootswatch.themes[x];
				themeEl.setAttribute('data-css', theme.cssMin);
				themeEl.innerHTML =	'<img src="' + theme.thumbnail + '" />' +
									'<div>' +
										'<div class="pull-right">' +
											'<button class="btn btn-primary" data-action="use">Use</button> ' +
											'<button class="btn" data-action="preview">Preview</button>' +
										'</div>' +
										'<h4>' + theme.name + '</h4>' +
										'<p>' + theme.description + '</p>' +
									'</div>';
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
				}
			}
		}, false);
	})();
</script>