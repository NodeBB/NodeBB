
'use strict';

/*globals define, config, socket, app*/

define('composer/tags', function() {
	var tags = {};

	tags.init = function(postContainer, postData) {
		var tagEl = postContainer.find('.tags');
		if (!tagEl.length) {
			return;
		}

		tagEl.tagsinput({
			maxTags: config.tagsPerTopic,
			maxChars: config.maximumTagLength,
			confirmKeys: [13, 44],
			trimValue: true
		});

		tagEl.on('beforeItemAdd', function(event) {
			event.cancel = event.item.length < config.minimumTagLength || event.item.length > config.maximumTagLength;
			if (event.item.length < config.minimumTagLength) {
				app.alertError('[[error:tag-too-short, ' + config.minimumTagLength + ']]');
			} else if (event.item.length > config.maximumTagLength) {
				app.alertError('[[error:tag-too-long, ' + config.maximumTagLength + ']]');
			}
		});

		tagEl.on('itemAdded', function(event) {
			$(window).trigger('action:tag.added', {cid: postData.cid, tagEl: tagEl, tag: event.item});
		});

		addTags(postData.tags, tagEl);

		var input = postContainer.find('.bootstrap-tagsinput input');

		app.loadJQueryUI(function() {
			input.autocomplete({
				delay: 100,
				open: function() {
					$(this).autocomplete('widget').css('z-index', 20000);
				},
				source: function(request, response) {
					socket.emit('topics.searchTags', {query: request.term, cid: postData.cid}, function(err, tags) {
						if (err) {
							return app.alertError(err.message);
						}
						if (tags) {
							response(tags);
						}
						$('.ui-autocomplete a').attr('data-ajaxify', 'false');
					});
				},
				select: function(event, ui) {
					// when autocomplete is selected from the dropdown simulate a enter key down to turn it into a tag
					triggerEnter(input);
				}
			});
		});

		input.attr('tabIndex', tagEl.attr('tabIndex'));
		input.on('blur', function() {
			triggerEnter(input);
		});
	};

	function triggerEnter(input) {
		// http://stackoverflow.com/a/3276819/583363
		var e = jQuery.Event('keypress');
		e.which = 13;
		e.keyCode = 13;
		setTimeout(function() {
			input.trigger(e);
		}, 100);
	}

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
