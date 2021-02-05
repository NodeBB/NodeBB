'use strict';

define('admin/manage/category', [
	'uploader',
	'iconSelect',
	'categorySelector',
	'benchpress',
	'api',
], function (uploader, iconSelect, categorySelector, Benchpress, api) {
	var	Category = {};
	var updateHash = {};

	Category.init = function () {
		$('#category-settings select').each(function () {
			var $this = $(this);
			$this.val($this.attr('data-value'));
		});

		categorySelector.init($('[component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				ajaxify.go('admin/manage/categories/' + selectedCategory.cid);
			},
			showLinks: true,
		});

		handleTags();

		$('#category-settings input, #category-settings select').on('change', function (ev) {
			modified(ev.target);
		});

		$('[data-name="imageClass"]').on('change', function () {
			$('.category-preview').css('background-size', $(this).val());
		});

		$('[data-name="bgColor"], [data-name="color"]').on('input', function () {
			var $inputEl = $(this);
			var previewEl = $inputEl.parents('[data-cid]').find('.category-preview');
			if ($inputEl.attr('data-name') === 'bgColor') {
				previewEl.css('background-color', $inputEl.val());
			} else if ($inputEl.attr('data-name') === 'color') {
				previewEl.css('color', $inputEl.val());
			}

			modified($inputEl[0]);
		});

		$('#save').on('click', function () {
			var tags = $('#tag-whitelist').val() ? $('#tag-whitelist').val().split(',') : [];
			if (tags.length && tags.length < parseInt($('#cid-min-tags').val(), 10)) {
				return app.alertError('[[admin/manage/categories:alert.not-enough-whitelisted-tags]]');
			}

			var cid = ajaxify.data.category.cid;
			api.put('/categories/' + cid, updateHash).then((res) => {
				app.flags._unsaved = false;
				app.alert({
					title: 'Updated Categories',
					message: 'Category "' + res.name + '" was successfully updated.',
					type: 'success',
					timeout: 5000,
				});
				updateHash = {};
			}).catch(app.alertError);

			return false;
		});

		$('.purge').on('click', function (e) {
			e.preventDefault();

			Benchpress.render('admin/partials/categories/purge', {
				name: ajaxify.data.category.name,
				topic_count: ajaxify.data.category.topic_count,
			}).then(function (html) {
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

								api.del('/categories/' + ajaxify.data.category.cid).then(() => {
									if (intervalId) {
										clearInterval(intervalId);
									}
									modal.modal('hide');
									app.alertSuccess('[[admin/manage/categories:alert.purge-success]]');
									ajaxify.go('admin/manage/categories');
								}).catch(app.alertError);

								return false;
							},
						},
					},
				});
			});
		});

		$('.copy-settings').on('click', function () {
			Benchpress.render('admin/partials/categories/copy-settings', {}).then(function (html) {
				var selectedCid;
				var modal = bootbox.dialog({
					title: '[[modules:composer.select_category]]',
					message: html,
					buttons: {
						save: {
							label: '[[modules:bootbox.confirm]]',
							className: 'btn-primary',
							callback: function () {
								if (!selectedCid || parseInt(selectedCid, 10) === parseInt(ajaxify.data.category.cid, 10)) {
									return;
								}

								socket.emit('admin.categories.copySettingsFrom', {
									fromCid: selectedCid,
									toCid: ajaxify.data.category.cid,
									copyParent: modal.find('#copyParent').prop('checked'),
								}, function (err) {
									if (err) {
										return app.alertError(err.message);
									}

									modal.modal('hide');
									app.alertSuccess('[[admin/manage/categories:alert.copy-success]]');
									ajaxify.refresh();
								});
								return false;
							},
						},
					},
				});
				modal.find('.modal-footer button').prop('disabled', true);
				categorySelector.init(modal.find('[component="category-selector"]'), {
					onSelect: function (selectedCategory) {
						selectedCid = selectedCategory && selectedCategory.cid;
						if (selectedCid) {
							modal.find('.modal-footer button').prop('disabled', false);
						}
					},
					showLinks: true,
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
			modified($('#category-image'));
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
			api.put('/categories/' + ajaxify.data.category.cid, {
				parentCid: 0,
			}).then(() => {
				$('button[data-action="removeParent"]').parent().addClass('hide');
				$('button[data-action="changeParent"]').parent().addClass('hide');
				$('button[data-action="setParent"]').removeClass('hide');
			}).catch(app.alertError);
		});
		$('button[data-action="toggle"]').on('click', function () {
			var $this = $(this);
			var disabled = $this.attr('data-disabled') === '1';
			api.put('/categories/' + ajaxify.data.category.cid, {
				disabled: disabled ? 0 : 1,
			}).then(() => {
				$this.translateText(!disabled ? '[[admin/manage/categories:enable]]' : '[[admin/manage/categories:disable]]');
				$this.toggleClass('btn-primary', !disabled).toggleClass('btn-danger', disabled);
				$this.attr('data-disabled', disabled ? 0 : 1);
			}).catch(app.alertError);
		});
	};

	function modified(el) {
		var value;
		if ($(el).is(':checkbox')) {
			value = $(el).is(':checked') ? 1 : 0;
		} else {
			value = $(el).val();
		}

		updateHash[$(el).attr('data-name')] = value;

		app.flags = app.flags || {};
		app.flags._unsaved = true;
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
		categorySelector.modal({
			onSubmit: function (selectedCategory) {
				var parentCid = selectedCategory.cid;
				if (!parentCid) {
					return;
				}
				api.put('/categories/' + ajaxify.data.category.cid, {
					parentCid: parentCid,
				}).then(() => {
					api.get(`/category/${parentCid}`).then(function (parent) {
						if (parent && parent.icon && parent.name) {
							var buttonHtml = '<i class="fa ' + parent.icon + '"></i> ' + parent.name;
							$('button[data-action="changeParent"]').html(buttonHtml).parent().removeClass('hide');
						}
					});

					$('button[data-action="removeParent"]').parent().removeClass('hide');
					$('button[data-action="setParent"]').addClass('hide');
				}).catch(app.alertError);
			},
			showLinks: true,
		});
	};

	return Category;
});
