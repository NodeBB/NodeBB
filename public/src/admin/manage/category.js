'use strict';

define('admin/manage/category', [
	'uploader',
	'iconSelect',
	'categorySelector',
	'benchpress',
	'api',
	'bootbox',
	'alerts',
	'admin/settings',
], function (uploader, iconSelect, categorySelector, Benchpress, api, bootbox, alerts, settings) {
	const Category = {};
	let updateHash = {};

	Category.init = function () {
		const categorySettings = $('#category-settings');
		const previewEl = $('[component="category/preview"]');
		categorySettings.find('select').each(function () {
			const $this = $(this);
			$this.val($this.attr('data-value'));
		});

		// category switcher
		categorySelector.init($('[component="settings/main/header"] [component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				ajaxify.go('admin/manage/categories/' + selectedCategory.cid);
			},
			cacheList: false,
			showLinks: true,
			template: 'admin/partials/category/selector-dropdown-right',
		});

		// parent selector
		categorySelector.init($('#parent-category-selector [component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				const parentCidInput = $('#parent-cid');
				parentCidInput.val(selectedCategory.cid);
				modified(parentCidInput[0]);
			},
			selectedCategory: ajaxify.data.category.parent, // switch selection to parent
			localCategories: [
				{
					cid: 0,
					name: '[[admin/manage/categories:parent-category-none]]',
					icon: 'fa-list',
				},
			],
			cacheList: false,
			showLinks: true,
			template: 'admin/partials/category/selector-dropdown-right',
		});

		handleTags();

		categorySettings.find('input, select, textarea').on('change', function (ev) {
			modified(ev.target);
		});
		$('[type="checkbox"]').on('change', function () {
			modified($(this));
		});

		$('[data-name="imageClass"]').on('change', function () {
			$('.category-preview').css('background-size', $(this).val());
		});

		$('[data-name="bgColor"], [data-name="color"]').on('input', function () {
			const $inputEl = $(this);
			if ($inputEl.attr('data-name') === 'bgColor') {
				previewEl.css('background-color', $inputEl.val());
			} else if ($inputEl.attr('data-name') === 'color') {
				previewEl.css('color', $inputEl.val());
			}

			modified($inputEl[0]);
		});

		$('#save').on('click', function () {
			const tags = $('#tag-whitelist').val() ? $('#tag-whitelist').val().split(',') : [];
			if (tags.length && tags.length < parseInt($('#cid-min-tags').val(), 10)) {
				return alerts.error('[[admin/manage/categories:alert.not-enough-whitelisted-tags]]');
			}

			const cid = ajaxify.data.category.cid;
			api.put('/categories/' + cid, updateHash).then(() => {
				app.flags._unsaved = false;
				settings.toggleSaveSuccess($('#save'));
				updateHash = {};
			}).catch(alerts.error);

			return false;
		});

		$('.purge').on('click', function (e) {
			e.preventDefault();

			Benchpress.render('admin/partials/categories/purge', {
				name: ajaxify.data.category.name,
				topic_count: ajaxify.data.category.topic_count,
			}).then(function (html) {
				const modal = bootbox.dialog({
					title: '[[admin/manage/categories:purge]]',
					message: html,
					size: 'large',
					buttons: {
						save: {
							label: '[[modules:bootbox.confirm]]',
							className: 'btn-primary',
							callback: function () {
								modal.find('.modal-footer button').prop('disabled', true);

								const intervalId = setInterval(async () => {
									if (!ajaxify.data.category) {
										// Already navigated away
										return;
									}

									try {
										const { count } = await api.get(`/categories/${ajaxify.data.category.cid}/count`);

										let percent = 0;
										if (ajaxify.data.category.topic_count > 0) {
											percent = Math.max(0, (1 - (count / ajaxify.data.category.topic_count))) * 100;
										}

										modal.find('.progress-bar').css({ width: percent + '%' });
									} catch (err) {
										clearInterval(intervalId);
										alerts.error(err);
									}
								}, 1000);

								api.del('/categories/' + ajaxify.data.category.cid).then(() => {
									if (intervalId) {
										clearInterval(intervalId);
									}
									modal.modal('hide');
									alerts.success('[[admin/manage/categories:alert.purge-success]]');
									setTimeout(() => {
										ajaxify.go('admin/manage/categories');
									}, 2500);
								}).catch(alerts.error);

								return false;
							},
						},
					},
				});
			});
		});

		$('.copy-settings').on('click', function () {
			Benchpress.render('admin/partials/categories/copy-settings', {}).then(function (html) {
				let selectedCid;
				const modal = bootbox.dialog({
					title: '[[modules:composer.select-category]]',
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
										return alerts.error(err);
									}

									modal.modal('hide');
									alert.success('[[admin/manage/categories:alert.copy-success]]');
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
			const inputEl = $(this);
			const cid = inputEl.attr('data-cid');

			uploader.show({
				title: '[[admin/manage/categories:alert.upload-image]]',
				route: config.relative_path + '/api/admin/category/uploadpicture',
				params: { cid: cid },
			}, function (imageUrlOnServer) {
				$('#category-image').val(imageUrlOnServer);
				previewEl.css('background-image', 'url(' + imageUrlOnServer + '?' + new Date().getTime() + ')');

				modified($('#category-image'));
			});
		});

		$('#category-image').on('change', function () {
			previewEl.css('background-image', $(this).val() ? ('url("' + $(this).val() + '")') : '');
			modified($('#category-image'));
		});

		$('.delete-image').on('click', function (e) {
			e.preventDefault();
			const inputEl = $('#category-image');
			inputEl.val('');
			previewEl.css('background-image', '');
			modified(inputEl[0]);
		});

		previewEl.on('click', function () {
			iconSelect.init($(this).find('i'), modified);
		});

		$('button[data-action="toggle"]').on('click', function () {
			const $this = $(this);
			const disabled = $this.attr('data-disabled') === '1';
			api.put('/categories/' + ajaxify.data.category.cid, {
				disabled: disabled ? 0 : 1,
			}).then(() => {
				$this.find('.label').translateText(
					!disabled ? '[[admin/manage/categories:enable]]' : '[[admin/manage/categories:disable]]'
				);
				$this.find('i')
					.toggleClass(['fa-check', 'text-success'], !disabled)
					.toggleClass(['fa-ban', 'text-danger'], disabled);
				$this.attr('data-disabled', disabled ? 0 : 1);
			}).catch(alerts.error);
		});
	};

	function modified(el) {
		let value;
		if ($(el).is(':checkbox')) {
			value = $(el).is(':checked') ? 1 : 0;
		} else {
			value = $(el).val();
		}
		const dataName = $(el).attr('data-name');
		const fields = dataName.match(/[^\][.]+/g);

		function setNestedFields(obj, index) {
			if (index === fields.length) {
				return;
			}
			obj[fields[index]] = obj[fields[index]] || {};
			if (index === fields.length - 1) {
				obj[fields[index]] = value;
			}
			setNestedFields(obj[fields[index]], index + 1);
		}

		if (fields && fields.length) {
			if (fields.length === 1) { // simple field name ie data-name="name"
				updateHash[fields[0]] = value;
			} else if (fields.length > 1) { // nested field name ie data-name="name[sub1][sub2]"
				setNestedFields(updateHash, 0);
			}
		}

		app.flags = app.flags || {};
		app.flags._unsaved = true;
	}

	function handleTags() {
		const tagEl = $('#tag-whitelist');
		tagEl.tagsinput({
			tagClass: 'badge bg-info',
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

	return Category;
});
