define('forum/account/header', function() {
	var	AccountHeader = {};

	AccountHeader.init = function() {
		displayAccountMenus();
		selectActivePill();
	};

	function displayAccountMenus() {
		$('.account-sub-links .plugin-link').each(function() {
			var $this = $(this);
			$this.toggleClass('hide', $this.hasClass('private'));
		});
	}

	function selectActivePill() {
		$('.account-sub-links li').removeClass('active').each(function() {
			var href = $(this).find('a').attr('href');
			if (window.location.href.indexOf(href) !== -1) {
				$(this).addClass('active');
				return false;
			}
		});
	}

	return AccountHeader;
});
