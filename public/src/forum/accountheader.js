define(function() {
	var	AccountHeader = {};

	AccountHeader.init = function() {

		hideLinks();

		selectActivePill();
	};

	function hideLinks() {
		var yourid = ajaxify.variables.get('yourid'),
			theirid = ajaxify.variables.get('theirid');

		var editLink = $('#editLink');
		var settingsLink = $('#settingsLink');
		var favouritesLink = $('#favouritesLink');

		if (parseInt(yourid, 10) === 0 || parseInt(yourid, 10) !== parseInt(theirid, 10)) {
			editLink.hide();
			settingsLink.hide();
			favouritesLink.hide();
		}

		if(app.isAdmin) {
			editLink.show();
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
