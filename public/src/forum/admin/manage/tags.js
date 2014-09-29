"use strict";
/*global define, socket, app, admin, utils, bootbox, RELATIVE_PATH*/

define('forum/admin/manage/tags', ['forum/infinitescroll'], function(infinitescroll) {
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

		$('.tag-item').on('click', function(ev) {
			var tagName = $(this).text(),
				tag = $(this),
				row = tag.parents('.tag-row');

			bootbox.dialog({
				title: "Editing " + tagName + " tag",
				message: $(this).parents('.tag-row').find('.tag-modal').html(),
				buttons: {
					success: {
						label: "Save",
						className: "btn-primary save",
						callback: function() {
							var modal = $('.bootbox'),
								bgColor = modal.find('[data-name="bgColor"]').val(),
									color = modal.find('[data-name="color"]').val();

							row.find('[data-name="bgColor"]').val(bgColor);
							row.find('[data-name="color"]').val(color);
							row.find('.tag-item').css('background-color', bgColor).css('color', color);

							save(tag);
						}
					},
					info: {
						label: "Click to view topics tagged \"" + tagName + "\"",
						className: "btn-info",
						callback: function() {
							window.open(RELATIVE_PATH + '/tags/' + tagName);
						}
					}
				}
			});

			setTimeout(function() {
				handleColorPickers();
			}, 500); // bootbox made me do it.
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
		console.log(data);
		socket.emit('admin.tags.update', data, function(err) {
			if (err) {
				return app.alertError(err.message);
			}
			app.alertSuccess('Tag Updated!');
		});
	}



	return Tags;
});