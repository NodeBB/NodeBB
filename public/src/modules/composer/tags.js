
'use strict';

/*globals define*/

define(function() {
	var tags = {};

	tags.init = function(postContainer, postData) {
		var tagEl = postContainer.find('.tags');
		if (!tagEl.length) {
			return;
		}

		tagEl.tagsinput({
			maxTags: config.tagsPerTopic,
			confirmKeys: [13, 188]
		});
		addTags(postData.tags, tagEl);

		var input = postContainer.find('.bootstrap-tagsinput input');
		input.autocomplete({
			delay: 100,
			source: function(request, response) {
				socket.emit('topics.searchTags', request.term, function(err, tags) {
					if (err) {
						return app.alertError(err.message)
					}
					if (tags) {
						response(tags);
						$('.ui-autocomplete a').attr('href', '#');
					}
				});
			},
			select: function(event, ui) {
				// when autocomplete is selected from the dropdown simulate a enter key down to turn it into a tag
				// http://stackoverflow.com/a/3276819/583363
				var e = jQuery.Event('keydown');
				e.which = 13;
				e.keyCode = 13;
				setTimeout(function() {
					input.trigger(e);
				}, 100);
			}
		});

		input.attr('tabIndex', tagEl.attr('tabIndex'));
	};

	function addTags(tags, tagEl) {
		if (tags && tags.length) {
			for(var i=0; i<tags.length; ++i) {
				tagEl.tagsinput('add', tags[i]);
			}
		}
	}

	tags.getTags = function(post_uuid) {
		return $('#cmp-uuid-' + post_uuid + ' .tags').tagsinput('items');
	};

	return tags;
});
