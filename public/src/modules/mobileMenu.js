define(function() {
	var mobileMenu = {};


	var categories = null,
		overlay = null,
		menuBtn = null;


	function loadCategories(callback) {
		if (categories) {
			displayCategories();
			return;
		}

		jQuery.getJSON('/api/home', function(data) {
			categories = data.categories;
			displayCategories();
		});
	}


	function displayCategories() {
		var baseIcon = document.createElement('a'),
			baseImage = document.createElement('i'),
			baseName = document.createElement('span');

		baseIcon.className = 'mobile-menu-icon';

		for (var i=0, ii=categories.length; i<ii; i++) {
			var icon = baseIcon.cloneNode(true),
				image = baseImage.cloneNode(true),
				name = baseName.cloneNode(true);

			var category = categories[i];

			image.className = category.icon + ' icon-3x';
			name.innerHTML = '<br />' + category.name;
			icon.appendChild(image);
			icon.appendChild(name);
			icon.src = 'category/' + category.slug;

			icon.onclick = function() {
				jQuery('.mobile-menu-icon').toggleClass('menu-visible');

				setTimeout(function() {
					jQuery(overlay).toggleClass('menu-visible');
				}, 200);

				ajaxify.go(this.src);
			}

			overlay.appendChild(icon);
		}
	}


	function animateIcons() {
		jQuery(overlay).toggleClass('menu-visible');
		setTimeout(function() {
			jQuery('.mobile-menu-icon').toggleClass('menu-visible');
		}, 100);
	}


	mobileMenu.init = function() {
		overlay = overlay || document.getElementById('mobile-menu-overlay');
		menuBtn = menuBtn || document.getElementById('mobile-menu-btn');
		
		menuBtn.onclick = function() {
			animateIcons();
		}


		loadCategories(displayCategories);
	}

	return {
		init: mobileMenu.init
	}
});