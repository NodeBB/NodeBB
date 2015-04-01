'use strict';
/* globals define, app, ajaxify */

define('forum/account/header', function() {
	var	AccountHeader = {};

	AccountHeader.init = function() {
		displayAccountMenus();
		selectActivePill();
	};

	function displayAccountMenus() {
		if (!app.user.uid || app.user.uid !== parseInt(ajaxify.variables.get('theirid'), 10)) {
			$('.account-sub-links .plugin-link.private').each(function() {
				$(this).addClass('hide');
			});
		}
	}

	function selectActivePill() {
		$('.account-sub-links li').removeClass('active').each(function() {
			var href = $(this).find('a').attr('href');
			
			if (href === window.location.pathname) {
				$(this).addClass('active');
				return false;
			}
		});
	}

	return AccountHeader;
});
