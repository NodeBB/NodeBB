(function() {
	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid');


	function createMenu() {
		var userslug = $('.account-username-box').attr('data-userslug');
		var links = $('<div class="account-sub-links inline-block pull-right">\
			<span id="settingsLink" class="pull-right"><a href="/users/' + userslug + '/settings">settings</a></span>\
			<span id="favouritesLink" class="pull-right"><a href="/users/' + userslug + '/favourites">favourites</a></span>\
			<span class="pull-right"><a href="/users/' + userslug + '/followers">followers</a></span>\
			<span class="pull-right"><a href="/users/' + userslug + '/following">following</a></span>\
			<span id="editLink" class="pull-right"><a href="/users/' + userslug + '/edit">edit</a></span>\
		</div>');

		$('.account-username-box').append(links);
	}

	$(document).ready(function() {

		createMenu();

		var editLink = $('#editLink');
		var settingsLink = $('#settingsLink');
		var favouritesLink = $('#favouritesLink');

		if (yourid === "0" || yourid !== theirid) {
			editLink.hide();
			settingsLink.hide();
			favouritesLink.hide();
		}

		jQuery('.account-sub-links span a').removeClass('bold').each(function() {
			var href = this.getAttribute('href');
			if (window.location.href.indexOf(href) !== -1) {
				jQuery(this).addClass('bold');
				return false;
			}
		});
	});

}());