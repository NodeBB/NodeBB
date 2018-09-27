'use strict';

define('admin/manage/category', [
	'uploader',
	'iconSelect',
	'admin/modules/colorpicker',
	'autocomplete',
	'translator',
	'categorySelector',
	'benchpress',
], function (uploader, iconSelect, colorpicker, autocomplete, translator, categorySelector, Benchpress) {
	var	Category = {};
	var modified_categories = {};

	Category.init = function () {
		$('#category-settings select').each(function () {
			var $this = $(this);
			$this.val($this.attr('data-value'));
		});

		$('#category-selector').on('change', function () {
			ajaxify.go('admin/manage/categories/' + $(this).val() + window.location.hash);
		});

		function enableColorPicker(idx, inputEl) {
			var $inputEl = $(inputEl);
			var previewEl = $inputEl.parents('[data-cid]').find('.category-preview');

			colorpicker.enable($inputEl, function (hsb, hex) {
				if ($inputEl.attr('data-name') === 'bgColor') {
					previewEl.css('background-color', '#' + hex);
				} else if ($inputEl.attr('data-name') === 'color') {
					previewEl.css('color', '#' + hex);
				}

				modified($inputEl[0]);
			});
		}

		handleTags();

		$('#category-settings input, #category-settings select').not($('.privilege-table-container input'))
			.on('change', function (ev) {
				modified(ev.target);
			})
			.on('keydown', function (ev) {
				if (ev.which === 13) {
					ev.preventDefault();
					return false;
				}
			});

		$('[data-name="imageClass"]').on('change', function () {
			$('.category-preview').css('background-size', $(this).val());
		});

		$('[data-name="bgColor"], [data-name="color"]').each(enableColorPicker);

		$('#save').on('click', function () {
			if (Object.keys(modified_categories).length) {
				socket.emit('admin.categories.update', modified_categories, function (err, result) {
					if (err) {
						return app.alertError(err.message);
					}

					if (result && result.length) {
						app.flags._unsaved = false;
						app.alert({
							title: 'Updated Categories',
							message: 'Category IDs ' + result.join(', ') + ' was successfully updated.',
							type: 'success',
							timeout: 2000,
						});
					}
				});
				modified_categories = {};
			}
			return false;
		});

		$('.purge').on('click', function (e) {
			e.preventDefault();

			Benchpress.parse('admin/partials/categories/purge', {
				name: ajaxify.data.category.name,
				topic_count: ajaxify.data.category.topic_count,
			}, function (html) {
				var modal = bootbox.dialog({
					title: '[[admin/manage/categories:purge]]',
					message: html,
					size: 'large',
					buttons: {
						save: {
							label: '[[modules:bootbox.confirm]]',
							className: 'btn-primary',
							callback: function () {
								modal.find('.modal-footer button').prop('disabled', true);

								var intervalId = setInterval(function () {
									socket.emit('categories.getTopicCount', ajaxify.data.category.cid, function (err, count) {
										if (err) {
											return app.alertError(err);
										}

										var percent = 0;
										if (ajaxify.data.category.topic_count > 0) {
											percent = Math.max(0, (1 - (count / ajaxify.data.category.topic_count))) * 100;
										}

										modal.find('.progress-bar').css({ width: percent + '%' });
									});
								}, 1000);

								socket.emit('admin.categories.purge', ajaxify.data.category.cid, function (err) {
									if (err) {
										return app.alertError(err.message);
									}

									if (intervalId) {
										clearInterval(intervalId);
									}
									modal.modal('hide');
									app.alertSuccess('[[admin/manage/categories:alert.purge-success]]');
									ajaxify.go('admin/manage/categories');
								});

								return false;
							},
						},
					},
				});
			});
		});

		$('.copy-settings').on('click', function () {
			categorySelector.modal(function (cid) {
				socket.emit('admin.categories.copySettingsFrom', { fromCid: cid, toCid: ajaxify.data.category.cid }, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[admin/manage/categories:alert.copy-success]]');
					ajaxify.refresh();
				});
			});
			return false;
		});

		$('.upload-button').on('click', function () {
			var inputEl = $(this);
			var cid = inputEl.attr('data-cid');

			uploader.show({
				title: '[[admin/manage/categories:alert.upload-image]]',
				route: config.relative_path + '/api/admin/category/uploadpicture',
				params: { cid: cid },
			}, function (imageUrlOnServer) {
				$('#category-image').val(imageUrlOnServer);
				var previewBox = inputEl.parent().parent().siblings('.category-preview');
				previewBox.css('background', 'url(' + imageUrlOnServer + '?' + new Date().getTime() + ')');

				modified($('#category-image'));
			});
		});

		$('#category-image').on('change', function () {
			$('.category-preview').css('background-image', $(this).val() ? ('url("' + $(this).val() + '")') : '');
		});

		$('.delete-image').on('click', function (e) {
			e.preventDefault();

			var inputEl = $('#category-image');
			var previewBox = $('.category-preview');

			inputEl.val('');
			previewBox.css('background-image', '');
			modified(inputEl[0]);
			$(this).parent().addClass('hide').hide();
		});

		$('.category-preview').on('click', function () {
			iconSelect.init($(this).find('i'), modified);
		});

		$('[type="checkbox"]').on('change', function () {
			modified($(this));
		});

		$('button[data-action="setParent"], button[data-action="changeParent"]').on('click', Category.launchParentSelector);
		$('button[data-action="removeParent"]').on('click', function () {
			var payload = {};
			payload[ajaxify.data.category.cid] = {
				parentCid: 0,
			};

			socket.emit('admin.categories.update', payload, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				$('button[data-action="removeParent"]').parent().addClass('hide');
				$('button[data-action="changeParent"]').parent().addClass('hide');
				$('button[data-action="setParent"]').removeClass('hide');
			});
		});
	};

	function modified(el) {
		var cid = ajaxify.data.category.cid;

		if (cid) {
			var value;
			if ($(el).is(':checkbox')) {
				value = $(el).is(':checked') ? 1 : 0;
			} else {
				value = $(el).val();
			}

			modified_categories[cid] = modified_categories[cid] || {};
			modified_categories[cid][$(el).attr('data-name')] = value;

			app.flags = app.flags || {};
			app.flags._unsaved = true;
		}
	}

	function handleTags() {
		var tagEl = $('#tag-whitelist');
		tagEl.tagsinput({
			confirmKeys: [13, 44],
			trimValue: true,
		});

		ajaxify.data.category.tagWhitelist.forEach(function (tag) {
			tagEl.tagsinput('add', tag);
		});

		tagEl.on('itemAdded itemRemoved', function () {
			modified(tagEl);
		});
	}

	Category.launchParentSelector = function () {
		var categories = ajaxify.data.allCategories.filter(function (category) {
			return category && !category.disabled && parseInt(category.cid, 10) !== parseInt(ajaxify.data.category.cid, 10);
		});

		categorySelector.modal(categories, function (parentCid) {
			var payload = {};

			payload[ajaxify.data.category.cid] = {
				parentCid: parentCid,
			};

			socket.emit('admin.categories.update', payload, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				var parent = ajaxify.data.allCategories.filter(function (category) {
					return category && parseInt(category.cid, 10) === parseInt(parentCid, 10);
				});
				parent = parent[0];

				$('button[data-action="removeParent"]').parent().removeClass('hide');
				$('button[data-action="setParent"]').addClass('hide');
				var buttonHtml = '<i class="fa ' + parent.icon + '"></i> ' + parent.name;
				$('button[data-action="changeParent"]').html(buttonHtml).parent().removeClass('hide');
			});
		});
	};

	return Category;
});
