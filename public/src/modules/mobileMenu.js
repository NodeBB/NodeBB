define(function() {
	var mobileMenu = {};


	var categories = null,
		overlay = null,
		menuBtn = null,
		postBtn = null,
		initialized = false;


	function loadCategories(callback) {
		if (categories) {
			callback(true);
			return;
		}

		jQuery.getJSON(RELATIVE_PATH+'/api/home', function(data) {
			categories = data.categories;
			initialized = true;

			if (callback) {
				callback(true);
			}
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


	mobileMenu.onNavigate = function() {
		if (initialized == false) return false;

		var cid = templates.get('category_id'),
			tid = templates.get('topic_id');

		if (cid) {
			postBtn.style.display = 'inline-block';
			postBtn.onclick = function() {
				require(['composer'], function(cmp) {
				    cmp.push(0, cid);
				});
			};
			postBtn.children[0].className = 'icon-plus icon-2x';
		} else if (tid) {
			postBtn.style.display = 'inline-block';
			postBtn.onclick = function() {
				require(['composer'], function(cmp) {
				    cmp.push(tid);
				});
			};
			postBtn.children[0].className = 'icon-reply icon-2x'
		} else {
			postBtn.style.display = 'none';
		}

	};


	mobileMenu.init = function() {
		overlay = overlay || document.getElementById('mobile-menu-overlay');
		menuBtn = menuBtn || document.getElementById('mobile-menu-btn');
		postBtn = postBtn || document.getElementById('mobile-post-btn');
		
		menuBtn.onclick = function() {
			animateIcons();
		}

		loadCategories(function() {
			displayCategories();
			mobileMenu.onNavigate();
		});
		
	}

	return {
		init: mobileMenu.init,
		onNavigate: mobileMenu.onNavigate
	}
});