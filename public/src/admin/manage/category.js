"use strict";
/*global define, app, socket, ajaxify, RELATIVE_PATH, bootbox */

define('admin/manage/category', [
	'uploader',
	'iconSelect',
	'admin/modules/colorpicker',
	'autocomplete'
], function(uploader, iconSelect, colorpicker, autocomplete) {
	var	Category = {};

	Category.init = function() {
		var modified_categories = {};

		function modified(el) {
			var cid = $(el).parents('form').attr('data-cid');

			if (cid) {
				modified_categories[cid] = modified_categories[cid] || {};
				modified_categories[cid][$(el).attr('data-name')] = $(el).val();
			}
		}

		function save(e) {
			e.preventDefault();

			if(Object.keys(modified_categories).length) {
				socket.emit('admin.categories.update', modified_categories, function(err, result) {
					if (err) {
						return app.alertError(err.message);
					}

					if (result && result.length) {
						app.alert({
							title: 'Updated Categories',
							message: 'Category IDs ' + result.join(', ') + ' was successfully updated.',
							type: 'success',
							timeout: 2000
						});
					}
				});
				modified_categories = {};
			}
		}

		$('.blockclass, form.category select').each(function() {
			var $this = $(this);
			$this.val($this.attr('data-value'));
		});

		function enableColorPicker(idx, inputEl) {
			var $inputEl = $(inputEl),
				previewEl = $inputEl.parents('[data-cid]').find('.category-preview');

			colorpicker.enable($inputEl, function(hsb, hex) {
				if ($inputEl.attr('data-name') === 'bgColor') {
					previewEl.css('background-color', '#' + hex);
				} else if ($inputEl.attr('data-name') === 'color') {
					previewEl.css('color', '#' + hex);
				}

				modified($inputEl[0]);
			});
		}

		// If any inputs have changed, prepare it for saving
		$('form.category input, form.category select').on('change', function(ev) {
			modified(ev.target);
		});

		// Update preview image size on change
		$('[data-name="imageClass"]').on('change', function(ev) {
			$('.category-preview').css('background-size', $(this).val());
		});

		// Colour Picker
		$('[data-name="bgColor"], [data-name="color"]').each(enableColorPicker);

		$('#save').on('click', save);
		$('.purge').on('click', function(e) {
			e.preventDefault();

			bootbox.confirm('<p class="lead">Do you really want to purge this category "' + $('form.category').find('input[data-name="name"]').val() + '"?</p><h5><strong class="text-danger">Warning!</strong> All topics and posts in this category will be purged!</h5> <p class="help-block">Purging a category will remove all topics and posts, and delete the category from the database. If you want to remove a category <em>temporarily</em>, you\'ll want to "disable" the category instead.</p>', function(confirm) {
				if (!confirm) {
					return;
				}
				socket.emit('admin.categories.purge', ajaxify.data.category.cid, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('Category purged!');
					ajaxify.go('admin/manage/categories');
				});
			});
		});

		// Image Uploader
		$('.upload-button').on('click', function() {
			var inputEl = $(this),
				cid = inputEl.attr('data-cid');

			uploader.open(RELATIVE_PATH + '/api/admin/category/uploadpicture', { cid: cid }, 0, function(imageUrlOnServer) {
				inputEl.val(imageUrlOnServer);
				var previewBox = inputEl.parent().parent().siblings('.category-preview');
				previewBox.css('background', 'url(' + imageUrlOnServer + '?' + new Date().getTime() + ')');
				modified(inputEl[0]);
			});
		});

		// Image Remover
		$('.delete-image').on('click', function(e) {
			e.preventDefault();

			var inputEl = $('.upload-button'),
				previewBox = inputEl.parent().parent().siblings('.category-preview');

			inputEl.val('');
			previewBox.css('background-image', '');
			modified(inputEl[0]);
			$(this).parent().addClass('hide').hide();
		});

		// Icon selection
		$('.category-preview').on('click', function(ev) {
			iconSelect.init($(this).find('i'), modified);
		});

		// Parent Category Selector
		$('button[data-action="setParent"], button[data-action="changeParent"]').on('click', Category.launchParentSelector);
		$('button[data-action="removeParent"]').on('click', function() {
			var payload= {};
			payload[ajaxify.data.category.cid] = {
				parentCid: 0
			};

			socket.emit('admin.categories.update', payload, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				$('button[data-action="removeParent"]').parent().addClass('hide');
				$('button[data-action="setParent"]').removeClass('hide');
			});
		});

		Category.setupPrivilegeTable();
	};

	Category.setupPrivilegeTable = function() {
		// Checkbox event capture
		$('.privilege-table-container').on('change', 'input[type="checkbox"]', function() {
			var checkboxEl = $(this),
				privilege = checkboxEl.parent().attr('data-privilege'),
				state = checkboxEl.prop('checked'),
				rowEl = checkboxEl.parents('tr'),
				member = rowEl.attr('data-group-name') || rowEl.attr('data-uid'),
				isPrivate = parseInt(rowEl.attr('data-private') || 0, 10),
				isGroup = rowEl.attr('data-group-name') !== undefined;

			if (member) {
				if (isGroup && privilege === 'groups:moderate' && !isPrivate && state) {
					bootbox.confirm('<strong>Are you sure you wish to grant the moderation privilege to this user group?</strong> This group is public, and any users can join at will.', function(confirm) {
						if (confirm) {
							Category.setPrivilege(member, privilege, state, checkboxEl);
						} else {
							checkboxEl.prop('checked', checkboxEl.prop('checked') ^ 1);
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

		Category.exposeAssumedPrivileges();
	};

	Category.refreshPrivilegeTable = function() {
		socket.emit('admin.categories.getPrivilegeSettings', ajaxify.data.category.cid, function(err, privileges) {
			if (err) {
				return app.alertError(err.message);
			}

			templates.parse('admin/partials/categories/privileges', {
				privileges: privileges
			}, function(html) {
				$('.privilege-table-container').html(html);
				Category.exposeAssumedPrivileges();
			});
		});
	};

	Category.exposeAssumedPrivileges = function() {
		/*
			If registered-users has a privilege enabled, then all users and groups of that privilege
			should be assumed to have that privilege as well, even if not set in the db, so reflect
			this arrangement in the table
		*/
		var privs = [];
		$('.privilege-table tr[data-group-name="registered-users"] td input[type="checkbox"]').parent().each(function(idx, el) {
			if ($(el).find('input').prop('checked')) {
				privs.push(el.getAttribute('data-privilege'));
			}
		});
		for(var x=0,numPrivs=privs.length;x<numPrivs;x++) {
			var inputs = $('.privilege-table tr[data-group-name]:not([data-group-name="registered-users"],[data-group-name="guests"]) td[data-privilege="' + privs[x] + '"] input');
			inputs.each(function(idx, el) {
				if (!el.checked) {
					el.indeterminate = true;
				}
			});
		}
	};

	Category.setPrivilege = function(member, privilege, state, checkboxEl) {
		socket.emit('admin.categories.setPrivilege', {
			cid: ajaxify.data.category.cid,
			privilege: privilege,
			set: state,
			member: member
		}, function(err) {
			if (err) {
				return app.alertError(err.message);
			}

			checkboxEl.replaceWith('<i class="fa fa-spin fa-spinner"></i>');
			Category.refreshPrivilegeTable();
		});
	};

	Category.launchParentSelector = function() {
		socket.emit('categories.get', function(err, categories) {
			templates.parse('partials/category_list', {
				categories: categories
			}, function(html) {
				var modal = bootbox.dialog({
					message: html,
					title: 'Set Parent Category'
				});

				modal.find('li[data-cid]').on('click', function() {
					var parentCid = $(this).attr('data-cid'),
						payload = {};

					payload[ajaxify.data.category.cid] = {
						parentCid: parentCid
					};

					socket.emit('admin.categories.update', payload, function(err) {
						if (err) {
							return app.alertError(err.message);
						}

						modal.modal('hide');
						$('button[data-action="removeParent"]').parent().removeClass('hide');
						$('button[data-action="setParent"]').addClass('hide');
					});
				});
			});
		});
	};

	Category.addUserToPrivilegeTable = function() {
		var modal = bootbox.dialog({
			title: 'Find a User',
			message: '<input class="form-control input-lg" placeholder="Search for a user here..." />',
			show: true
		});

		modal.on('shown.bs.modal', function() {
			var inputEl = modal.find('input');

			autocomplete.user(inputEl, function(ev, ui) {
				socket.emit('admin.categories.setPrivilege', {
					cid: ajaxify.data.category.cid,
					privilege: ['find', 'read'],
					set: true,
					member: ui.item.user.uid
				}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}

					Category.refreshPrivilegeTable();
					modal.modal('hide');
				});
			});
		});
	};

	Category.addGroupToPrivilegeTable = function() {
		var modal = bootbox.dialog({
			title: 'Find a Group',
			message: '<input class="form-control input-lg" placeholder="Search for a group here..." />',
			show: true
		});

		modal.on('shown.bs.modal', function() {
			var inputEl = modal.find('input');

			autocomplete.group(inputEl, function(ev, ui) {
				socket.emit('admin.categories.setPrivilege', {
					cid: ajaxify.data.category.cid,
					privilege: ['groups:find', 'groups:read'],
					set: true,
					member: ui.item.group.name
				}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}

					Category.refreshPrivilegeTable();
					modal.modal('hide');
				});
			});
		});
	};

	return Category;
});