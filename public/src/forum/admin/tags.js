"use strict";
/*global define, socket, app, admin, utils*/

define('forum/admin/tags', ['forum/infinitescroll'], function(infinitescroll) {
	var	Tags = {};
	var timeoutId = 0;

	Tags.init = function() {
		handleColorPickers();

		$('.tag-list').on('click', '.save', function() {
			save($(this));
		});

		$('#tag-search').on('input propertychange', function() {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}
			timeoutId = setTimeout(function() {
				socket.emit('topics.searchAndLoadTags', {query: $('#tag-search').val()}, function(err, tags) {
					if (err) {
						return app.alertError(err.message);
					}
					infinitescroll.parseAndTranslate('admin/tags', 'tags', {tags: tags}, function(html) {
						$('.tag-list').html(html);
						utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
						timeoutId = 0;
					});
				});
			}, 100);
		});
	};

	function handleColorPickers() {
		function enableColorPicker(idx, inputEl) {
			var $inputEl = $(inputEl),
				previewEl = $inputEl.parents('.tag-row').find('.tag-item');

			admin.enableColorPicker($inputEl, function(hsb, hex) {
				if ($inputEl.attr('data-name') === 'bgColor') {
					previewEl.css('background-color', '#' + hex);
				} else if ($inputEl.attr('data-name') === 'color') {
					previewEl.css('color', '#' + hex);
				}
			});
		}


		$('[data-name="bgColor"], [data-name="color"]').each(enableColorPicker);
	}

	function save(saveBtn) {
		var tagRow = saveBtn.parents('.tag-row');

		var data = {
			tag: tagRow.attr('data-tag'),
			bgColor : tagRow.find('[data-name="bgColor"]').val(),
			color : tagRow.find('[data-name="color"]').val()
		};

		socket.emit('admin.tags.update', data, function(err) {
			if (err) {
				return app.alertError(err.message);
			}
			app.alertSuccess('Tag Updated!');
		});
	}



	return Tags;
});