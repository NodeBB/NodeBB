define(function() {
	var	AccountHeader = {};

	AccountHeader.init = function() {
		displayAccountMenus();
		selectActivePill();
	};

	function displayAccountMenus() {
		var yourid = ajaxify.variables.get('yourid'),
			theirid = ajaxify.variables.get('theirid');

		var editLink = $('#editLink'),
			settingsLink = $('#settingsLink'),
			favouritesLink = $('#favouritesLink');

		if (parseInt(yourid, 10) !== 0 && parseInt(yourid, 10) === parseInt(theirid, 10)) {
			editLink.removeClass('hide');
			settingsLink.removeClass('hide');
			favouritesLink.removeClass('hide');
		}

		if(app.isAdmin) {
			editLink.removeClass('hide');
		}
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
