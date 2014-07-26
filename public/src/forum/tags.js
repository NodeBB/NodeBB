'use strict';

/* globals define, app */

define('forum/tags', function() {
	var Tags = {};

	Tags.init = function() {
		app.enterRoom('tags');

		$('#tag-search').on('input propertychange', function() {
			$('.tag-list').children().each(function() {
				var $this = $(this);
				$this.toggleClass('hide', $this.find('a').attr('data-value').indexOf($('#tag-search').val()) === -1);
			})
		});
	};

	return Tags;
});
