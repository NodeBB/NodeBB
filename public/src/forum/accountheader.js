define(function() {
	var	AccountHeader = {};

	AccountHeader.init = function() {


		AccountHeader.createMenu();

		hideLinks();

		selectActivePill();
	};

	AccountHeader.createMenu = function() {
		var userslug = $('.account-username-box').attr('data-userslug');

		var html ='<ul class="nav nav-pills account-sub-links">\
					<li id="settingsLink"><a href="' + RELATIVE_PATH + '/user/' + userslug + '/settings">[[user:settings]]</a></li>\
					<li id="favouritesLink"><a href="' + RELATIVE_PATH + '/user/' + userslug + '/favourites">[[user:favourites]]</a></li>\
					<li><a href="' + RELATIVE_PATH + '/user/' + userslug + '/posts">[[global:posts]]</a></li>\
					<li><a href="' + RELATIVE_PATH + '/user/' + userslug + '/followers">[[user:followers]]</a></li>\
					<li><a href="' + RELATIVE_PATH + '/user/' + userslug + '/following">[[user:following]]</a></li>\
					<li id="editLink"><a href="' + RELATIVE_PATH + '/user/' + userslug + '/edit">[[user:edit]]</a></li>\
					<li id="profile"><a href="' + RELATIVE_PATH + '/user/' + userslug + '">[[user:profile]]</a></li>\
				</ul>';


		translator.translate(html, function(translatedHtml) {
			$('.account-username-box').append(translatedHtml);
			selectActivePill();
			hideLinks();
		});
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