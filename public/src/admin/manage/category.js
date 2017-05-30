'use strict';


define('admin/manage/category', [
	'uploader',
	'iconSelect',
	'admin/modules/colorpicker',
	'autocomplete',
	'translator',
	'categorySelector',
], function (uploader, iconSelect, colorpicker, autocomplete, translator, categorySelector) {
	var	Category = {};
	var modified_categories = {};

	Category.init = function () {
		$('#category-settings select').each(function () {
			var $this = $(this);
			$this.val($this.attr('data-value'));
		});

		$('#category-selector').on('change', function () {
			ajaxify.go('admin/manage/categories/' + $(this).val());
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

			bootbox.confirm(translator.compile(
				'admin/manage/categories:alert.confirm-purge',
				$('form.category').find('input[data-name="name"]').val()
			), function (confirm) {
				if (!confirm) {
					return;
				}
				socket.emit('admin.categories.purge', ajaxify.data.category.cid, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[admin/manage/categories:alert.purge-success]]');
					ajaxify.go('admin/manage/categories');
				});
			});
		});

		$('.copy-settings').on('click', function () {
			selectCategoryModal(function (cid) {
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

		Category.setupPrivilegeTable();

		handleTags();
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

	Category.setupPrivilegeTable = function () {
		$('.privilege-table-container').on('change', 'input[type="checkbox"]', function () {
			var checkboxEl = $(this);
			var privilege = checkboxEl.parent().attr('data-privilege');
			var state = checkboxEl.prop('checked');
			var rowEl = checkboxEl.parents('tr');
			var member = rowEl.attr('data-group-name') || rowEl.attr('data-uid');
			var isPrivate = parseInt(rowEl.attr('data-private') || 0, 10);
			var isGroup = rowEl.attr('data-group-name') !== undefined;

			if (member) {
				if (isGroup && privilege === 'groups:moderate' && !isPrivate && state) {
					bootbox.confirm('[[admin/manage/categories:alert.confirm-moderate]]', function (confirm) {
						if (confirm) {
							Category.setPrivilege(member, privilege, state, checkboxEl);
						} else {
							checkboxEl.prop('checked', !checkboxEl.prop('checked'));
						}
					});
				} else {
					Category.setPrivilege(member, privilege, state, checkboxEl);
				}
			} else {
				app.alertError('[[error:invalid-data]]');
			}
		});

		$('.privilege-table-container').on('click', '[data-action="search.user"]', Category.addUserToPrivilegeTable);
		$('.privilege-table-container').on('click', '[data-action="search.group"]', Category.addGroupToPrivilegeTable);
		$('.privilege-table-container').on('click', '[data-action="copyToChildren"]', Category.copyPrivilegesToChildren);
		$('.privilege-table-container').on('click', '[data-action="copyPrivilegesFrom"]', Category.copyPrivilegesFromCategory);

		Category.exposeAssumedPrivileges();
	};

	Category.refreshPrivilegeTable = function () {
		socket.emit('admin.categories.getPrivilegeSettings', ajaxify.data.category.cid, function (err, privileges) {
			if (err) {
				return app.alertError(err.message);
			}

			templates.parse('admin/partials/categories/privileges', {
				privileges: privileges,
			}, function (html) {
				translator.translate(html, function (html) {
					$('.privilege-table-container').html(html);
					Category.exposeAssumedPrivileges();
				});
			});
		});
	};

	Category.exposeAssumedPrivileges = function () {
		/*
			If registered-users has a privilege enabled, then all users and groups of that privilege
			should be assumed to have that privilege as well, even if not set in the db, so reflect
			this arrangement in the table
		*/
		var privs = [];
		$('.privilege-table tr[data-group-name="registered-users"] td input[type="checkbox"]').parent().each(function (idx, el) {
			if ($(el).find('input').prop('checked')) {
				privs.push(el.getAttribute('data-privilege'));
			}
		});
		for (var x = 0, numPrivs = privs.length; x < numPrivs; x += 1) {
			var inputs = $('.privilege-table tr[data-group-name]:not([data-group-name="registered-users"],[data-group-name="guests"]) td[data-privilege="' + privs[x] + '"] input');
			inputs.each(function (idx, el) {
				if (!el.checked) {
					el.indeterminate = true;
				}
			});
		}
	};

	Category.setPrivilege = function (member, privilege, state, checkboxEl) {
		socket.emit('admin.categories.setPrivilege', {
			cid: ajaxify.data.category.cid,
			privilege: privilege,
			set: state,
			member: member,
		}, function (err) {
			if (err) {
				return app.alertError(err.message);
			}

			checkboxEl.replaceWith('<i class="fa fa-spin fa-spinner"></i>');
			Category.refreshPrivilegeTable();
		});
	};

	Category.launchParentSelector = function () {
		var categories = ajaxify.data.allCategories.filter(function (category) {
			return category && !category.disabled && parseInt(category.cid, 10) !== parseInt(ajaxify.data.category.cid, 10);
		});

		selectCategoryModal(categories, function (parentCid) {
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

	Category.addUserToPrivilegeTable = function () {
		var modal = bootbox.dialog({
			title: '[[admin/manage/categories:alert.find-user]]',
			message: '<input class="form-control input-lg" placeholder="[[admin/manage/categories:alert.user-search]]" />',
			show: true,
		});

		modal.on('shown.bs.modal', function () {
			var inputEl = modal.find('input');

			autocomplete.user(inputEl, function (ev, ui) {
				socket.emit('admin.categories.setPrivilege', {
					cid: ajaxify.data.category.cid,
					privilege: ['find', 'read', 'topics:read'],
					set: true,
					member: ui.item.user.uid,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}

					Category.refreshPrivilegeTable();
					modal.modal('hide');
				});
			});
		});
	};

	Category.addGroupToPrivilegeTable = function () {
		var modal = bootbox.dialog({
			title: '[[admin/manage/categories:alert.find-group]]',
			message: '<input class="form-control input-lg" placeholder="[[admin/manage/categories:alert.group-search]]" />',
			show: true,
		});

		modal.on('shown.bs.modal', function () {
			var inputEl = modal.find('input');

			autocomplete.group(inputEl, function (ev, ui) {
				socket.emit('admin.categories.setPrivilege', {
					cid: ajaxify.data.category.cid,
					privilege: ['groups:find', 'groups:read', 'groups:topics:read'],
					set: true,
					member: ui.item.group.name,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}

					Category.refreshPrivilegeTable();
					modal.modal('hide');
				});
			});
		});
	};

	Category.copyPrivilegesToChildren = function () {
		socket.emit('admin.categories.copyPrivilegesToChildren', ajaxify.data.category.cid, function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			app.alertSuccess('Privileges copied!');
		});
	};

	Category.copyPrivilegesFromCategory = function () {
		selectCategoryModal(function (cid) {
			socket.emit('admin.categories.copyPrivilegesFrom', { toCid: ajaxify.data.category.cid, fromCid: cid }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				ajaxify.refresh();
			});
		});
	};

	function selectCategoryModal(categories, callback) {
		if (typeof categories === 'function') {
			callback = categories;
			categories = ajaxify.data.allCategories;
		}
		templates.parse('admin/partials/categories/select-category', {
			categories: categories,
		}, function (html) {
			translator.translate(html, function (html) {
				var modal = bootbox.dialog({
					title: '[[modules:composer.select_category]]',
					message: html,
					buttons: {
						save: {
							label: '[[global:select]]',
							className: 'btn-primary',
							callback: submit,
						},
					},
				});
				categorySelector.init(modal.find('[component="category-selector"]'));
				function submit(ev) {
					ev.preventDefault();
					var selectedCategory = categorySelector.getSelectedCategory();
					if (selectedCategory) {
						callback(selectedCategory.cid);
						modal.modal('hide');
					}
					return false;
				}

				modal.find('form').on('submit', submit);
			});
		});
	}

	return Category;
});
