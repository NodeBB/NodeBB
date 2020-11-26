'use strict';

define('admin/manage/privileges', [
	'autocomplete',
	'translator',
	'categorySelector',
	'mousetrap',
	'admin/modules/checkboxRowSelector',
], function (autocomplete, translator, categorySelector, mousetrap, checkboxRowSelector) {
	var Privileges = {};

	var cid;

	Privileges.init = function () {
		cid = isNaN(parseInt(ajaxify.data.selectedCategory.cid, 10)) ? 'admin' : ajaxify.data.selectedCategory.cid;

		checkboxRowSelector.init('.privilege-table-container');

		categorySelector.init($('[component="category-selector"]'), function (category) {
			cid = parseInt(category.cid, 10);
			cid = isNaN(cid) ? 'admin' : cid;
			Privileges.refreshPrivilegeTable();
			ajaxify.updateHistory('admin/manage/privileges/' + (cid || ''));
		});

		Privileges.setupPrivilegeTable();

		highlightRow();
	};

	Privileges.setupPrivilegeTable = function () {
		$('.privilege-table-container').on('change', 'input[type="checkbox"]', function () {
			var checkboxEl = $(this);
			var wrapperEl = checkboxEl.parent();
			var privilege = wrapperEl.attr('data-privilege');
			var state = checkboxEl.prop('checked');
			var rowEl = checkboxEl.parents('tr');
			var member = rowEl.attr('data-group-name') || rowEl.attr('data-uid');
			var isPrivate = parseInt(rowEl.attr('data-private') || 0, 10);
			var isGroup = rowEl.attr('data-group-name') !== undefined;
			var delta = checkboxEl.prop('checked') === (wrapperEl.attr('data-value') === 'true') ? null : state;

			if (member) {
				if (isGroup && privilege === 'groups:moderate' && !isPrivate && state) {
					bootbox.confirm('[[admin/manage/privileges:alert.confirm-moderate]]', function (confirm) {
						if (confirm) {
							wrapperEl.attr('data-delta', delta);
							Privileges.exposeAssumedPrivileges();
						} else {
							checkboxEl.prop('checked', !checkboxEl.prop('checked'));
						}
					});
				} else {
					wrapperEl.attr('data-delta', delta);
					Privileges.exposeAssumedPrivileges();
				}
				checkboxRowSelector.updateState(checkboxEl);
			} else {
				app.alertError('[[error:invalid-data]]');
			}
		});

		Privileges.exposeAssumedPrivileges();
		checkboxRowSelector.updateAll();
		Privileges.addEvents();	// events with confirmation modals
	};

	Privileges.addEvents = function () {
		document.getElementById('save').addEventListener('click', function () {
			throwConfirmModal('save', Privileges.commit);
		});

		document.getElementById('discard').addEventListener('click', function () {
			throwConfirmModal('discard', Privileges.discard);
		});

		$('.privilege-table-container').on('click', '[data-action="search.user"]', Privileges.addUserToPrivilegeTable);
		$('.privilege-table-container').on('click', '[data-action="search.group"]', Privileges.addGroupToPrivilegeTable);
		$('.privilege-table-container').on('click', '[data-action="copyToChildren"]', function () {
			throwConfirmModal('copyToChildren', Privileges.copyPrivilegesToChildren.bind(null, cid, ''));
		});
		$('.privilege-table-container').on('click', '[data-action="copyToChildrenGroup"]', function () {
			var groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			throwConfirmModal('copyToChildrenGroup', Privileges.copyPrivilegesToChildren.bind(null, cid, groupName));
		});

		$('.privilege-table-container').on('click', '[data-action="copyPrivilegesFrom"]', function () {
			Privileges.copyPrivilegesFromCategory(cid, '');
		});
		$('.privilege-table-container').on('click', '[data-action="copyPrivilegesFromGroup"]', function () {
			var groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			Privileges.copyPrivilegesFromCategory(cid, groupName);
		});

		$('.privilege-table-container').on('click', '[data-action="copyToAll"]', function () {
			throwConfirmModal('copyToAll', Privileges.copyPrivilegesToAllCategories.bind(null, cid, ''));
		});
		$('.privilege-table-container').on('click', '[data-action="copyToAllGroup"]', function () {
			var groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			throwConfirmModal('copyToAllGroup', Privileges.copyPrivilegesToAllCategories.bind(null, cid, groupName));
		});

		mousetrap.bind('ctrl+s', function (ev) {
			throwConfirmModal('save', Privileges.commit);
			ev.preventDefault();
		});

		function throwConfirmModal(method, onConfirm) {
			bootbox.confirm('[[admin/manage/privileges:alert.confirm-' + method + ']]<br /><br />[[admin/manage/privileges:alert.no-undo]]', function (ok) {
				if (ok) {
					onConfirm.call();
				}
			});
		}
	};

	Privileges.commit = function () {
		var tableEl = document.querySelector('.privilege-table-container');
		var requests = $.map(tableEl.querySelectorAll('td[data-delta]'), function (el) {
			var privilege = el.getAttribute('data-privilege');
			var rowEl = el.parentNode;
			var member = rowEl.getAttribute('data-group-name') || rowEl.getAttribute('data-uid');
			var state = el.getAttribute('data-delta') === 'true' ? 1 : 0;

			return Privileges.setPrivilege(member, privilege, state);
		});

		Promise.allSettled(requests).then(function () {
			Privileges.refreshPrivilegeTable();
			app.alertSuccess('[[admin/manage/privileges:alert.saved]]');
		});
	};

	Privileges.discard = function () {
		Privileges.refreshPrivilegeTable();
		app.alertSuccess('[[admin/manage/privileges:alert.discarded]]');
	};

	Privileges.refreshPrivilegeTable = function (groupToHighlight) {
		socket.emit('admin.categories.getPrivilegeSettings', cid, function (err, privileges) {
			if (err) {
				return app.alertError(err.message);
			}

			ajaxify.data.privileges = privileges;
			var tpl = parseInt(cid, 10) ? 'admin/partials/privileges/category' : 'admin/partials/privileges/global';
			app.parseAndTranslate(tpl, {
				privileges: privileges,
			}, function (html) {
				$('.privilege-table-container').html(html);
				Privileges.exposeAssumedPrivileges();
				checkboxRowSelector.updateAll();

				hightlightRowByDataAttr('data-group-name', groupToHighlight);
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
		$('.privilege-table tr[data-group-name="registered-users"] td input[type="checkbox"]:not(.checkbox-helper)').parent().each(function (idx, el) {
			if ($(el).find('input').prop('checked')) {
				privs.push(el.getAttribute('data-privilege'));
			}
		});

		// Also apply to non-group privileges
		privs = privs.concat(privs.map(function (priv) {
			if (priv.startsWith('groups:')) {
				return priv.slice(7);
			}

			return false;
		})).filter(Boolean);

		for (var x = 0, numPrivs = privs.length; x < numPrivs; x += 1) {
			var inputs = $('.privilege-table tr[data-group-name]:not([data-group-name="registered-users"],[data-group-name="guests"],[data-group-name="spiders"]) td[data-privilege="' + privs[x] + '"] input, .privilege-table tr[data-uid] td[data-privilege="' + privs[x] + '"] input');
			inputs.each(function (idx, el) {
				if (!el.checked) {
					el.indeterminate = true;
				}
			});
		}
	};

	Privileges.setPrivilege = function (member, privilege, state) {
		return new Promise(function (resolve, reject) {
			socket.emit('admin.categories.setPrivilege', {
				cid: isNaN(cid) ? 0 : cid,
				privilege: privilege,
				set: state,
				member: member,
			}, function (err) {
				if (err) {
					reject(err);
					return app.alertError(err.message);
				}

				resolve();
			});
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
				addUserToCategory(ui.item.user, function () {
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
				if (ui.item.group.name === 'administrators') {
					return app.alert({
						type: 'warning',
						message: '[[admin/manage/privileges:alert.admin-warning]]',
					});
				}
				addGroupToCategory(ui.item.group.name, function () {
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

	function hightlightRowByDataAttr(attrName, attrValue) {
		if (attrValue) {
			var el = $('[' + attrName + ']').filter(function () {
				return $(this).attr(attrName) === String(attrValue);
			});

			if (el.length) {
				el.addClass('selected');
				return true;
			}
		}
		return false;
	}

	function highlightRow() {
		if (ajaxify.data.group) {
			if (hightlightRowByDataAttr('data-group-name', ajaxify.data.group)) {
				return;
			}
			addGroupToCategory(ajaxify.data.group);
		}
	}

	function addGroupToCategory(group, cb) {
		cb = cb || function () {};
		var groupRow = document.querySelector('.privilege-table [data-group-name="' + group + '"]');
		if (groupRow) {
			hightlightRowByDataAttr('data-group-name', group);
			return cb();
		}
		// Generate data for new row
		var privilegeSet = ajaxify.data.privileges.keys.groups.reduce(function (memo, cur) {
			memo[cur] = false;
			return memo;
		}, {});

		app.parseAndTranslate('admin/partials/privileges/' + ((isNaN(cid) || cid === 0) ? 'global' : 'category'), 'privileges.groups', {
			privileges: {
				groups: [
					{
						name: group,
						nameEscaped: translator.escape(group),
						privileges: privilegeSet,
					},
				],
			},
		}, function (html) {
			var tableEl = document.querySelector('.privilege-table');
			var rows = tableEl.querySelectorAll('tbody tr');
			html.insertBefore(rows[rows.length - 1]);
			Privileges.exposeAssumedPrivileges();
			hightlightRowByDataAttr('data-group-name', group);
			cb();
		});
	}

	function addUserToCategory(user, cb) {
		cb = cb || function () {};
		var userRow = document.querySelector('.privilege-table [data-uid="' + user.uid + '"]');
		if (userRow) {
			hightlightRowByDataAttr('data-uid', user.uid);
			return cb();
		}
		// Generate data for new row
		var privilegeSet = ajaxify.data.privileges.keys.users.reduce(function (memo, cur) {
			memo[cur] = false;
			return memo;
		}, {});

		app.parseAndTranslate('admin/partials/privileges/' + (isNaN(cid) ? 'global' : 'category'), 'privileges.users', {
			privileges: {
				users: [
					{
						picture: user.picture,
						username: user.username,
						uid: user.uid,
						'icon:text': user['icon:text'],
						'icon:bgColor': user['icon:bgColor'],
						privileges: privilegeSet,
					},
				],
			},
		}, function (html) {
			var tableEl = document.querySelectorAll('.privilege-table');
			var rows = tableEl[1].querySelectorAll('tbody tr');
			html.insertBefore(rows[rows.length - 1]);
			hightlightRowByDataAttr('data-uid', user.uid);
			cb();
		});
	}

	return Privileges;
});
