"use strict";

define('forum/groups/details', function() {
	var Details = {};

	Details.init = function() {
		var	memberListEl = $('.groups.details .members');

		memberListEl.on('click', '[data-slug]', function() {
			var	slug = this.getAttribute('data-slug');
			ajaxify.go('user/' + slug);
		});

		$('.latest-posts .content img').addClass('img-responsive');
	};

	return Details;
});