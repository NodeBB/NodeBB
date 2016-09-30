"use strict";
/*global define, socket, app, utils, bootbox, ajaxify*/

define('admin/manage/tags', [
	'forum/infinitescroll',
	'admin/modules/selectable',
	'admin/modules/colorpicker'
], function(infinitescroll, selectable, colorpicker) {
	var	Tags = {},
		timeoutId = 0;

	Tags.init = function() {
		selectable.enable('.tag-management', '.tag-row');

		handleCreate();
		handleSearch();
		handleModify();
		handleDeleteSelected();
	};

	function handleCreate() {
		var createModal = $('#create-modal');
		var createTagName = $('#create-tag-name');
		var createModalGo = $('#create-modal-go');

		createModal.on('keypress', function(e) {
			if (e.keyCode === 13) {
				createModalGo.click();
			}
		});

		$('#create').on('click', function() {
			createModal.modal('show');
			setTimeout(function() {
				createTagName.focus();
			}, 250);
		});

		createModalGo.on('click', function() {
			socket.emit('admin.tags.create', {
				tag: createTagName.val()
			}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				createTagName.val('');
				createModal.on('hidden.bs.modal', function() {
					ajaxify.refresh();
				});
				createModal.modal('hide');
			});
		});
	}

	function handleSearch() {
		$('#tag-search').on('input propertychange', function() {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}

			timeoutId = setTimeout(function() {
				socket.emit('topics.searchAndLoadTags', {query: $('#tag-search').val()}, function(err, result) {
					if (err) {
						return app.alertError(err.message);
					}

					app.parseAndTranslate('admin/manage/tags', 'tags', {tags: result.tags}, function(html) {
						$('.tag-list').html(html);
						utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
						timeoutId = 0;

						selectable.enable('.tag-management', '.tag-row');
					});
				});
			}, 100);
		});
	}

	function handleModify() {
		$('#modify').on('click', function() {
			var tagsToModify = $('.tag-row.ui-selected');
			if (!tagsToModify.length) {
				return;
			}

			var firstTag = $(tagsToModify[0]),
				title = tagsToModify.length > 1 ? 'Editing multiple tags' : 'Editing ' + firstTag.find('.tag-item').text() + ' tag';

			var modal = bootbox.dialog({
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

			handleColorPickers(modal);
		});
	}

	function handleDeleteSelected() {
		$('#deleteSelected').on('click', function() {
			var tagsToDelete = $('.tag-row.ui-selected');
			if (!tagsToDelete.length) {
				return;
			}

			bootbox.confirm('Do you want to delete the selected tags?', function(confirm) {
				if (!confirm) {
					return;
				}
				var tags = [];
				tagsToDelete.each(function(index, el) {
					tags.push($(el).attr('data-tag'));
				});
				socket.emit('admin.tags.deleteTags', {tags: tags}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					tagsToDelete.remove();
				});
			});
		});
	}

	function handleColorPickers(modal) {
		function enableColorPicker(idx, inputEl) {
			var $inputEl = $(inputEl);
			colorpicker.enable($inputEl);
		}

		modal.find('[data-name="bgColor"], [data-name="color"]').each(enableColorPicker);
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