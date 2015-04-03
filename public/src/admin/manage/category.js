"use strict";
/*global define, app, socket, ajaxify, RELATIVE_PATH, bootbox */

define('admin/manage/category', [
	'uploader',
	'iconSelect',
	'admin/modules/colorpicker',
	'autocomplete',
	'nodebb-templatist'
], function(uploader, iconSelect, colorpicker, autocomplete, templatist) {
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
				previewEl = $inputEl.parents('[data-cid]').find('.preview-box');

			colorpicker.enable($inputEl, function(hsb, hex) {
				if ($inputEl.attr('data-name') === 'bgColor') {
					previewEl.css('background', '#' + hex);
				} else if ($inputEl.attr('data-name') === 'color') {
					previewEl.css('color', '#' + hex);
				}

				modified($inputEl[0]);
			});
		}

		function setupEditTargets() {
			$('[data-edit-target]').on('click', function() {
				var $this = $(this),
					target = $($this.attr('data-edit-target'));

				$this.addClass('hide');
				target.removeClass('hide').on('blur', function() {
					$this.removeClass('hide').children('span').html(this.value);
					$(this).addClass('hide');
				}).val($this.children('span').html());

				target.focus();
			});
		}

		// If any inputs have changed, prepare it for saving
		$('form.category input, form.category select').on('change', function(ev) {
			modified(ev.target);
		});

		// Colour Picker
		$('[data-name="bgColor"], [data-name="color"]').each(enableColorPicker);

		$('.save').on('click', save);
		$('.revert').on('click', ajaxify.refresh);
		$('.purge').on('click', function(e) {
			e.preventDefault();

			bootbox.confirm('<p class="lead">Do you really want to purge this category "' + $('form.category').find('input[data-name="name"]').val() + '"?</p><p><strong class="text-danger">Warning!</strong> All topics and posts in this category will be purged!</p>', function(confirm) {
				if (!confirm) {
					return;
				}
				socket.emit('admin.categories.purge', ajaxify.variables.get('cid'), function(err) {
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
				previewBox.css('background', 'url(' + imageUrlOnServer + '?' + new Date().getTime() + ')')
					.css('background-size', 'cover');
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
		$('button[data-action="setParent"]').on('click', Category.launchParentSelector);
		$('button[data-action="removeParent"]').on('click', function() {
			var payload= {};
			payload[ajaxify.variables.get('cid')] = {
				parentCid: 0
			};

			socket.emit('admin.categories.update', payload, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				ajaxify.refresh();
			});
		});

		setupEditTargets();
		Category.setupPrivilegeTable();
	};

	Category.setupPrivilegeTable = function() {
		var searchEl = $('.privilege-search'),
			searchObj = autocomplete.user(searchEl);

		// User search + addition to table
		searchObj.on('autocompleteselect', function(ev, ui) {
			socket.emit('admin.categories.setPrivilege', {
				cid: ajaxify.variables.get('cid'),
				privilege: 'read',
				set: true,
				member: ui.item.user.uid
			}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				Category.refreshPrivilegeTable();
				searchEl.val('');
			});
		});

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
		})
	};

	Category.refreshPrivilegeTable = function() {
		socket.emit('admin.categories.getPrivilegeSettings', ajaxify.variables.get('cid'), function(err, privileges) {
			if (err) {
				return app.alertError(err.message);
			}

			templatist.render('admin/partials/categories/privileges', {
				privileges: privileges
			}, function(err, html) {
				$('.privilege-table-container').html(html);
			});
		});
	};

	Category.setPrivilege = function(member, privilege, state, checkboxEl) {
		socket.emit('admin.categories.setPrivilege', {
			cid: ajaxify.variables.get('cid'),
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
			templatist.render('partials/category_list', {
				categories: categories
			}, function(err, html) {
				var modal = bootbox.dialog({
					message: html,
					title: 'Set Parent Category'
				});

				modal.find('li[data-cid]').on('click', function() {
					var parentCid = $(this).attr('data-cid'),
						payload = {};

					payload[ajaxify.variables.get('cid')] = {
						parentCid: parentCid
					};

					socket.emit('admin.categories.update', payload, function(err) {
						if (err) {
							return app.alertError(err.message);
						}

						modal.modal('hide');
						ajaxify.refresh();
					});
				});
			});
		});
	};

	return Category;
});