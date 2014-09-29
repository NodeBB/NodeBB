"use strict";
/*global define, socket, app, bootbox, templates, ajaxify, RELATIVE_PATH*/

define('forum/admin/manage/categories', ['uploader', 'forum/admin/iconSelect'], function(uploader, iconSelect) {
	var	Categories = {};

	Categories.init = function() {
		var modified_categories = {};

		function modified(el) {
			var cid = $(el).parents('li').attr('data-cid');
			if(cid) {
				modified_categories[cid] = modified_categories[cid] || {};
				modified_categories[cid][$(el).attr('data-name')] = $(el).val();
			}
		}

		function save() {
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
			return false;
		}

		function update_blockclass(el) {
			el.parentNode.parentNode.className = 'entry-row ' + el.value;
		}

		function updateCategoryOrders() {
			var categories = $('.admin-categories #entry-container').children();
			for(var i = 0; i<categories.length; ++i) {
				var input = $(categories[i]).find('input[data-name="order"]');

				input.val(i+1).attr('data-value', i+1);
				modified(input);
			}
		}

		$('#entry-container').sortable({
			stop: function(event, ui) {
				updateCategoryOrders();
			},
			distance: 10
		});

		$('.blockclass, .admin-categories form select').each(function() {
			var $this = $(this);
			$this.val($this.attr('data-value'));
		});

		function showCreateCategoryModal() {
			$('#new-category-modal').modal();
		}

		function createNewCategory() {
			var category = {
				name: $('#inputName').val(),
				description: $('#inputDescription').val(),
				icon: $('#new-category-modal i').attr('value'),
				bgColor: '#0059b2',
				color: '#fff',
				order: $('.admin-categories #entry-container').children().length + 1
			};

			socket.emit('admin.categories.create', category, function(err, data) {
				if(err) {
					return app.alertError(err.message);
				}

				app.alert({
					alert_id: 'category_created',
					title: 'Created',
					message: 'Category successfully created!',
					type: 'success',
					timeout: 2000
				});

				$('#new-category-modal').modal('hide');
				ajaxify.refresh();
			});
		}

		function enableColorPicker(idx, inputEl) {
			var $inputEl = $(inputEl),
				previewEl = $inputEl.parents('[data-cid]').find('.preview-box');

			admin.enableColorPicker($inputEl, function(hsb, hex) {
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

		$(function() {
			var url = window.location.href,
				parts = url.split('/'),
				active = parts[parts.length - 1];

			$('.nav-pills li').removeClass('active');
			$('.nav-pills li a').each(function() {
				var $this = $(this);
				if ($this.attr('href').match(active)) {
					$this.parent().addClass('active');
					return false;
				}
			});


			$('#addNew').on('click', showCreateCategoryModal);
			$('#create-category-btn').on('click', createNewCategory);

			$('#entry-container, #new-category-modal').on('click', '.icon', function(ev) {
				iconSelect.init($(this).find('i'), modified);
			});

			$('.admin-categories form input, .admin-categories form select').on('change', function(ev) {
				modified(ev.target);
			});

			$('.dropdown').on('click', '[data-disabled]', function(ev) {
				var btn = $(this),
					categoryRow = btn.parents('li'),
					cid = categoryRow.attr('data-cid'),
					disabled = btn.attr('data-disabled') === 'false' ? '1' : '0';

				categoryRow.remove();
				modified_categories[cid] = modified_categories[cid] || {};
				modified_categories[cid].disabled = disabled;

				save();
				return false;
			});

			// Colour Picker
			$('[data-name="bgColor"], [data-name="color"]').each(enableColorPicker);

			$('.admin-categories').on('click', '.save', save);
			$('.admin-categories').on('click', '.purge', function() {
				var categoryRow = $(this).parents('li[data-cid]');
				var	cid = categoryRow.attr('data-cid');

				bootbox.confirm('Do you really want to purge this category "' + categoryRow.find('#cid-' + cid + '-name').val() + '"?<br/><strong class="text-danger">Warning!</strong> All topics and posts in this category will be purged!', function(confirm) {
					if (!confirm) {
						return;
					}
					socket.emit('admin.categories.purge', cid, function(err) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('Category purged!');
						categoryRow.remove();
					});
				});
			});

			$('.admin-categories').on('click', '.permissions', function() {
				var	cid = $(this).parents('li[data-cid]').attr('data-cid');
				Categories.launchPermissionsModal(cid);
				return false;
			});


			$('.admin-categories').on('click', '.upload-button', function() {
				var inputEl = $(this),
					cid = inputEl.parents('li[data-cid]').attr('data-cid');

				uploader.open(RELATIVE_PATH + '/admin/category/uploadpicture', { cid: cid }, 0, function(imageUrlOnServer) {
					inputEl.val(imageUrlOnServer);
					var previewBox = inputEl.parents('li[data-cid]').find('.preview-box');
					previewBox.css('background', 'url(' + imageUrlOnServer + '?' + new Date().getTime() + ')')
						.css('background-size', 'cover');
					modified(inputEl[0]);
				});
			});

			$('.admin-categories').on('click', '.delete-image', function() {
				var parent = $(this).parents('li[data-cid]'),
					inputEl = parent.find('.upload-button'),
					preview = parent.find('.preview-box'),
					bgColor = parent.find('.category_bgColor').val();

				inputEl.val('');
				modified(inputEl[0]);

				preview.css('background', bgColor);

				$(this).addClass('hide').hide();
			});

			$('#revertChanges').on('click', function() {
				ajaxify.refresh();
			});

			setupEditTargets();

			$('button[data-action="setParent"]').on('click', function() {
				var cid = $(this).parents('[data-cid]').attr('data-cid'),
					modal = $('#setParent');

				modal.find('select').val($(this).attr('data-parentCid'));
				modal.attr('data-cid', cid).modal();
			});

			$('button[data-action="removeParent"]').on('click', function() {
				var cid = $(this).parents('[data-cid]').attr('data-cid');
				var payload= {};
				payload[cid] = {
					parentCid: 0
				};
				socket.emit('admin.categories.update', payload, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					ajaxify.go('admin/categories/active');
				});
			});

			$('#setParent [data-cid]').on('click', function() {
				var modalEl = $('#setParent'),
					parentCid = $(this).attr('data-cid'),
					payload = {};

				payload[modalEl.attr('data-cid')] = {
					parentCid: parentCid
				};

				socket.emit('admin.categories.update', payload, function(err) {
					modalEl.one('hidden.bs.modal', function() {
						ajaxify.go('admin/categories/active');
					});
					modalEl.modal('hide');
				});
			});
		});
	};

	Categories.launchPermissionsModal = function(cid) {
		var	modal = $('#category-permissions-modal'),
			searchEl = modal.find('#permission-search'),
			resultsEl = modal.find('.search-results.users'),
			groupsResultsEl = modal.find('.search-results.groups'),
			searchDelay;

		// Clear the search field and results
		searchEl.val('');
		resultsEl.html('');

		searchEl.off().on('keyup', function() {
			var	searchEl = this,
				liEl;

			clearTimeout(searchDelay);

			searchDelay = setTimeout(function() {
				socket.emit('admin.categories.search', {
					username: searchEl.value,
					cid: cid
				}, function(err, results) {
					if(err) {
						return app.alertError(err.message);
					}

					templates.parse('admin/partials/categories/users', {
						users: results
					}, function(html) {
						resultsEl.html(html);
					});
				});
			}, 250);
		});

		Categories.refreshPrivilegeList(cid);

		resultsEl.off().on('click', '[data-priv]', function(e) {
			var	anchorEl = $(this),
				uid = anchorEl.parents('li[data-uid]').attr('data-uid'),
				privilege = anchorEl.attr('data-priv');
			e.preventDefault();
			e.stopPropagation();

			socket.emit('admin.categories.setPrivilege', {
				cid: cid,
				uid: uid,
				privilege: privilege,
				set: !anchorEl.hasClass('active')
			}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				anchorEl.toggleClass('active', !anchorEl.hasClass('active'));
				Categories.refreshPrivilegeList(cid);
			});
		});

		modal.off().on('click', '.members li > img', function() {
			searchEl.val($(this).attr('title'));
			searchEl.keyup();
		});

		// User Groups and privileges
		socket.emit('admin.categories.groupsList', cid, function(err, results) {
			if(err) {
				return app.alertError(err.message);
			}

			templates.parse('admin/partials/categories/groups', {
				groups: results
			}, function(html) {
				groupsResultsEl.html(html);
			});
		});

		groupsResultsEl.off().on('click', '[data-priv]', function(e) {
			var	anchorEl = $(this),
				name = anchorEl.parents('li[data-name]').attr('data-name'),
				privilege = anchorEl.attr('data-priv');
			e.preventDefault();
			e.stopPropagation();

			socket.emit('admin.categories.setGroupPrivilege', {
				cid: cid,
				name: name,
				privilege: privilege,
				set: !anchorEl.hasClass('active')
			}, function(err) {
				if (!err) {
					anchorEl.toggleClass('active');
				}
			});
		});

		modal.modal();
	};

	Categories.refreshPrivilegeList = function (cid) {
		var	modalEl = $('#category-permissions-modal'),
			memberList = $('.members');

		socket.emit('admin.categories.getPrivilegeSettings', cid, function(err, privilegeList) {
			var	membersLength = privilegeList.length,
				liEl, x, userObj;

			memberList.html('');
			if (membersLength > 0) {
				for(x = 0; x < membersLength; x++) {
					userObj = privilegeList[x];
					liEl = $('<li/>').attr('data-uid', userObj.uid).html('<img src="' + userObj.picture + '" title="' + userObj.username + '" />');
					memberList.append(liEl);
				}
			} else {
				liEl = $('<li/>').addClass('empty').html('None.');
				memberList.append(liEl);
			}
		});
	};

	return Categories;
});