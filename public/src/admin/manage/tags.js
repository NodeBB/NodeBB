"use strict";
/*global define, socket, app, admin, utils, bootbox, RELATIVE_PATH*/

define('admin/manage/tags', ['forum/infinitescroll', 'admin/modules/selectable'], function(infinitescroll, selectable) {
	var	Tags = {},
		timeoutId = 0;

	Tags.init = function() {
		handleColorPickers();
		selectable.enable('.tag-management', '.tag-row');

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

					infinitescroll.parseAndTranslate('admin/manage/tags', 'tags', {tags: tags}, function(html) {
						$('.tag-list').html(html);
						utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
						timeoutId = 0;

						selectable.enable('.tag-management', '.tag-row');
					});
				});
			}, 100);
		});

		$('#modify').on('click', function(ev) {
			var tagsToModify = $('.tag-row.selected');
			if (!tagsToModify.length) {
				return;
			}

			var firstTag = $(tagsToModify[0]),
				title = tagsToModify.length > 1 ? 'Editing multiple tags' : 'Editing ' + firstTag.find('.tag-item').text() + ' tag';

			bootbox.dialog({
				title:  title,
				message: firstTag.find('.tag-modal').html(),
				buttons: {
					success: {
						label: "Save",
						className: "btn-primary save",
						callback: function() {
							var modal = $('.bootbox'),
								bgColor = modal.find('[data-name="bgColor"]').val(),
								color = modal.find('[data-name="color"]').val();

							tagsToModify.each(function(idx, tag) {
								tag = $(tag);

								tag.find('[data-name="bgColor"]').val(bgColor);
								tag.find('[data-name="color"]').val(color);
								tag.find('.tag-item').css('background-color', bgColor).css('color', color);

								save(tag);
							});
						}
					}
				}
			});

			setTimeout(function() {
				handleColorPickers();
			}, 500);
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

	function save(tag) {
		var data = {
			tag: tag.attr('data-tag'),
			bgColor : tag.find('[data-name="bgColor"]').val(),
			color : tag.find('[data-name="color"]').val()
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