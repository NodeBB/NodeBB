'use strict';

define('admin/manage/privileges', [
	'autocomplete',
	'translator',
	'benchpress',
	'categorySelector',
], function (autocomplete, translator, Benchpress, categorySelector) {
	var	Privileges = {};

	var cid;

	Privileges.init = function () {
		cid = isNaN(parseInt(ajaxify.data.cid, 10)) ? 'admin' : ajaxify.data.cid;

		categorySelector.init($('[component="category-selector"]'), function (category) {
			cid = parseInt(category.cid, 10);
			cid = isNaN(cid) ? 'admin' : cid;
			Privileges.refreshPrivilegeTable();
			ajaxify.updateHistory('admin/manage/privileges/' + (cid || ''));
		});

		Privileges.setupPrivilegeTable();
	};

	Privileges.setupPrivilegeTable = function () {
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
							Privileges.setPrivilege(member, privilege, state, checkboxEl);
						} else {
							checkboxEl.prop('checked', !checkboxEl.prop('checked'));
						}
					});
				} else {
					Privileges.setPrivilege(member, privilege, state, checkboxEl);
				}
			} else {
				app.alertError('[[error:invalid-data]]');
			}
		});

		$('.privilege-table-container').on('click', '[data-action="search.user"]', Privileges.addUserToPrivilegeTable);
		$('.privilege-table-container').on('click', '[data-action="search.group"]', Privileges.addGroupToPrivilegeTable);
		$('.privilege-table-container').on('click', '[data-action="copyToChildren"]', function () {
			Privileges.copyPrivilegesToChildren(cid, '');
		});
		$('.privilege-table-container').on('click', '[data-action="copyToChildrenGroup"]', function () {
			var groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			Privileges.copyPrivilegesToChildren(cid, groupName);
		});

		$('.privilege-table-container').on('click', '[data-action="copyPrivilegesFrom"]', function () {
			Privileges.copyPrivilegesFromCategory(cid, '');
		});
		$('.privilege-table-container').on('click', '[data-action="copyPrivilegesFromGroup"]', function () {
			var groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			Privileges.copyPrivilegesFromCategory(cid, groupName);
		});

		$('.privilege-table-container').on('click', '[data-action="copyToAll"]', function () {
			Privileges.copyPrivilegesToAllCategories(cid, '');
		});
		$('.privilege-table-container').on('click', '[data-action="copyToAllGroup"]', function () {
			var groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			Privileges.copyPrivilegesToAllCategories(cid, groupName);
		});

		Privileges.exposeAssumedPrivileges();
	};

	Privileges.refreshPrivilegeTable = function () {
		socket.emit('admin.categories.getPrivilegeSettings', cid, function (err, privileges) {
			if (err) {
				return app.alertError(err.message);
			}

			var tpl = parseInt(cid, 10) ? 'admin/partials/privileges/category' : 'admin/partials/privileges/global';
			Benchpress.parse(tpl, {
				privileges: privileges,
			}, function (html) {
				translator.translate(html, function (html) {
					$('.privilege-table-container').html(html);
					Privileges.exposeAssumedPrivileges();
				});
			});
		});
	};

	Privileges.exposeAssumedPrivileges = function () {
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
			var inputs = $('.privilege-table tr[data-group-name]:not([data-group-name="registered-users"],[data-group-name="guests"],[data-group-name="spiders"]) td[data-privilege="' + privs[x] + '"] input');
			inputs.each(function (idx, el) {
				if (!el.checked) {
					el.indeterminate = true;
				}
			});
		}
	};

	Privileges.setPrivilege = function (member, privilege, state, checkboxEl) {
		socket.emit('admin.categories.setPrivilege', {
			cid: isNaN(cid) ? 0 : cid,
			privilege: privilege,
			set: state,
			member: member,
		}, function (err) {
			if (err) {
				return app.alertError(err.message);
			}

			checkboxEl.replaceWith('<i class="fa fa-spin fa-spinner"></i>');
			Privileges.refreshPrivilegeTable();
		});
	};

	Privileges.addUserToPrivilegeTable = function () {
		var modal = bootbox.dialog({
			title: '[[admin/manage/categories:alert.find-user]]',
			message: '<input class="form-control input-lg" placeholder="[[admin/manage/categories:alert.user-search]]" />',
			show: true,
		});

		modal.on('shown.bs.modal', function () {
			var inputEl = modal.find('input');
			inputEl.focus();

			autocomplete.user(inputEl, function (ev, ui) {
				var defaultPrivileges;
				if (ajaxify.data.url === '/admin/manage/privileges/admin') {
					defaultPrivileges = ['admin:dashboard'];
				} else {
					defaultPrivileges = cid ? ['find', 'read', 'topics:read'] : ['chat'];
				}
				socket.emit('admin.categories.setPrivilege', {
					cid: isNaN(cid) ? 0 : cid,
					privilege: defaultPrivileges,
					set: true,
					member: ui.item.user.uid,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}

					Privileges.refreshPrivilegeTable();
					modal.modal('hide');
				});
			});
		});
	};

	Privileges.addGroupToPrivilegeTable = function () {
		var modal = bootbox.dialog({
			title: '[[admin/manage/categories:alert.find-group]]',
			message: '<input class="form-control input-lg" placeholder="[[admin/manage/categories:alert.group-search]]" />',
			show: true,
		});

		modal.on('shown.bs.modal', function () {
			var inputEl = modal.find('input');
			inputEl.focus();

			autocomplete.group(inputEl, function (ev, ui) {
				var defaultPrivileges;
				if (ajaxify.data.url === '/admin/manage/privileges/admin') {
					defaultPrivileges = ['groups:admin:dashboard'];
				} else {
					defaultPrivileges = cid ? ['groups:find', 'groups:read', 'groups:topics:read'] : ['groups:chat'];
				}

				socket.emit('admin.categories.setPrivilege', {
					cid: isNaN(cid) ? 0 : cid,
					privilege: defaultPrivileges,
					set: true,
					member: ui.item.group.name,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}

					Privileges.refreshPrivilegeTable();
					modal.modal('hide');
				});
			});
		});
	};

	Privileges.copyPrivilegesToChildren = function (cid, group) {
		socket.emit('admin.categories.copyPrivilegesToChildren', { cid: cid, group: group }, function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			app.alertSuccess('[[admin/manage/categories:privileges.copy-success]]');
		});
	};

	Privileges.copyPrivilegesFromCategory = function (cid, group) {
		categorySelector.modal(ajaxify.data.categories.slice(1), function (fromCid) {
			socket.emit('admin.categories.copyPrivilegesFrom', { toCid: cid, fromCid: fromCid, group: group }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				ajaxify.refresh();
			});
		});
	};

	Privileges.copyPrivilegesToAllCategories = function (cid, group) {
		socket.emit('admin.categories.copyPrivilegesToAllCategories', { cid: cid, group: group }, function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			app.alertSuccess('[[admin/manage/categories:privileges.copy-success]]');
		});
	};

	return Privileges;
});
