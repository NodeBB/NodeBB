'use strict';


define('admin/manage/privileges', [
	'autocomplete',
	'translator',
	'benchpress',
], function (autocomplete, translator, Benchpress) {
	var	Privileges = {};

	Privileges.init = function () {
		$('#category-selector').on('change', function () {
			var val = $(this).val();
			if (val !== 'global') {
				ajaxify.go('admin/manage/categories/' + $(this).val() + '#privileges');
			}
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
				Privileges.setPrivilege(member, privilege, state, checkboxEl);
			} else {
				app.alertError('[[error:invalid-data]]');
			}
		});

		$('.privilege-table-container').on('click', '[data-action="search.user"]', Privileges.addUserToPrivilegeTable);
		$('.privilege-table-container').on('click', '[data-action="search.group"]', Privileges.addGroupToPrivilegeTable);

		Privileges.exposeAssumedPrivileges();
	};

	Privileges.refreshPrivilegeTable = function () {
		socket.emit('admin.categories.getPrivilegeSettings', function (err, privileges) {
			if (err) {
				return app.alertError(err.message);
			}

			Benchpress.parse('admin/partials/global/privileges', {
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
			var inputs = $('.privilege-table tr[data-group-name]:not([data-group-name="registered-users"],[data-group-name="guests"]) td[data-privilege="' + privs[x] + '"] input');
			inputs.each(function (idx, el) {
				if (!el.checked) {
					el.indeterminate = true;
				}
			});
		}
	};

	Privileges.setPrivilege = function (member, privilege, state, checkboxEl) {
		socket.emit('admin.categories.setPrivilege', {
			cid: 0,
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

			autocomplete.user(inputEl, function (ev, ui) {
				socket.emit('admin.categories.setPrivilege', {
					cid: 0,
					privilege: ['chat'],
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

			autocomplete.group(inputEl, function (ev, ui) {
				socket.emit('admin.categories.setPrivilege', {
					cid: 0,
					privilege: ['groups:chat'],
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

	return Privileges;
});
