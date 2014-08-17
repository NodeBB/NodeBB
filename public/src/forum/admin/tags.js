"use strict";
/*global define, socket, app, admin*/

define('forum/admin/tags', [], function() {
	var	Tags = {};

	Tags.init = function() {
		handleColorPickers();

		$('.tag-list').on('click', '.save', function() {
			save($(this));
		});

		$('#tag-search').on('input propertychange', function() {
			$('.tag-list').children().each(function() {
				var $this = $(this);
				$this.toggleClass('hide', $this.attr('data-tag').indexOf($('#tag-search').val()) === -1);
			});
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