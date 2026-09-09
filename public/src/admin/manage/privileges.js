'use strict';

define('admin/manage/privileges', [
	'api',
	'autocomplete',
	'modals',
	'alerts',
	'translator',
	'categorySelector',
	'mousetrap',
	'admin/modules/checkboxRowSelector',
	'admin/settings',
], function (
	api, autocomplete, modals, alerts, translator,
	categorySelector, mousetrap, checkboxRowSelector, settings
) {
	const Privileges = {};

	let cid;

	// Resolves the selector's raw cid value into the form used throughout this module:
	// the string 'all' (every category), the string 'admin', or a numeric category id
	// (0 = global). Anything non-numeric that isn't 'all' falls back to 'admin'.
	function normalizeCid(rawCid) {
		if (rawCid === 'all') {
			return 'all';
		}
		const parsed = parseInt(rawCid, 10);
		return isNaN(parsed) ? 'admin' : parsed;
	}

	// 'category' template applies when viewing a single real category OR the "all
	// categories" aggregate; 'global' covers cid 0 (global) and the admin pseudo-cid.
	function getPrivilegeTablePartial() {
		const isCategoryView = cid === 'all' || parseInt(cid, 10);
		return `admin/partials/privileges/${isCategoryView ? 'category' : 'global'}`;
	}

	Privileges.init = function () {
		cid = normalizeCid(ajaxify.data.selectedCategory.cid);

		checkboxRowSelector.init('.privilege-table-container');

		categorySelector.init($('[component="category-selector"]'), {
			onSelect: function (category) {
				cid = normalizeCid(category.cid);
				Privileges.refreshPrivilegeTable();
				ajaxify.updateHistory('admin/manage/privileges/' + (cid || ''));
			},
			localOnly: true,
			localCategories: ajaxify.data.categories,
			privilege: 'find',
			showLinks: true,
		});

		Privileges.setupPrivilegeTable();

		highlightRow();
		$('.privilege-filters button:first-child').click();
	};

	Privileges.setupPrivilegeTable = function () {
		$('.privilege-table-container').on('change', 'input[type="checkbox"]:not(.checkbox-helper)', function () {
			const checkboxEl = this;
			const $checkboxEl = $(this);
			const $wrapperEl = $checkboxEl.parents('[data-privilege]');
			const columnNo = $wrapperEl.index() + 1;
			const privilege = $wrapperEl.attr('data-privilege');
			const state = $checkboxEl.prop('checked');
			const $rowEl = $checkboxEl.parents('tr');
			const member = $rowEl.attr('data-group-name') || $rowEl.attr('data-uid');
			const isPrivate = parseInt($rowEl.attr('data-private') || 0, 10);
			const isGroup = $rowEl.attr('data-group-name') !== undefined;
			const isBanned = (isGroup && $rowEl.attr('data-group-name') === 'banned-users') || $rowEl.attr('data-banned') !== undefined;
			const sourceGroupName = isBanned ? 'banned-users' : 'registered-users';
			const dataValue = $wrapperEl.attr('data-value');
			// When viewing all categories at once a privilege may be granted in only some of
			// them (data-value="mixed"); any deliberate click there is always a real change,
			// applied to every category. Otherwise a click that returns to the original state
			// is a no-op (delta = null).
			const delta = dataValue === 'mixed' ?
				state :
				(state === (dataValue === 'true') ? null : state);

			if (member) {
				if (isGroup && privilege === 'groups:moderate' && !isPrivate && state) {
					modals.confirm('[[admin/manage/privileges:alert.confirm-moderate]]', function (confirm) {
						if (confirm) {
							$wrapperEl.attr('data-delta', delta);
							Privileges.applyDeltaState(checkboxEl, delta);
							Privileges.exposeSingleAssumedPriv(columnNo, sourceGroupName);
						} else {
							$checkboxEl.prop('checked', !$checkboxEl.prop('checked'));
						}
					});
				} else if (privilege.endsWith('admin:admins-mods') && state) {
					modals.confirm('[[admin/manage/privileges:alert.confirm-admins-mods]]', function (confirm) {
						if (confirm) {
							$wrapperEl.attr('data-delta', delta);
							Privileges.applyDeltaState(checkboxEl, delta);
							Privileges.exposeSingleAssumedPriv(columnNo, sourceGroupName);
						} else {
							$checkboxEl.prop('checked', !$checkboxEl.prop('checked'));
						}
					});
				} else {
					$wrapperEl.attr('data-delta', delta);
					Privileges.applyDeltaState(checkboxEl, delta);
					Privileges.exposeSingleAssumedPriv(columnNo, sourceGroupName);
				}
				checkboxRowSelector.updateState($checkboxEl);
			} else {
				alerts.error('[[error:invalid-data]]');
			}
		});

		// Mixed states must be applied before assumed privileges, so that the inheritance
		// pass (which reads the parent row) can treat an indeterminate parent as granted.
		Privileges.exposeMixedPrivileges();
		Privileges.exposeAssumedPrivileges();
		checkboxRowSelector.updateAll();
		Privileges.addEvents(); // events with confirmation modals
	};

	// In the "all categories" view, privileges granted in some but not all categories are
	// rendered with data-value="mixed". Show them as indeterminate checkboxes.
	Privileges.exposeMixedPrivileges = function () {
		$('.privilege-table td[data-value="mixed"] input[type="checkbox"]').each(function () {
			this.indeterminate = true;
		});
	};

	Privileges.applyDeltaState = (checkboxEl, delta) => {
		['bg-success', 'bg-opacity-75', 'border-success'].forEach((className) => {
			checkboxEl.classList.toggle(className, delta === true);
		});
		['bg-danger', 'bg-opacity-50', 'border-danger'].forEach((className) => {
			checkboxEl.classList.toggle(className, delta === false);
		});
	};

	Privileges.addEvents = function () {
		document.getElementById('save').addEventListener('click', function () {
			throwConfirmModal('save', Privileges.commit);
		});

		document.getElementById('discard').addEventListener('click', function () {
			throwConfirmModal('discard', Privileges.discard);
		});

		// Expose discard button as necessary
		const containerEl = document.querySelector('.privilege-table-container');
		containerEl.addEventListener('change', (e) => {
			const subselector = e.target.closest('td[data-privilege] input');
			if (subselector) {
				document.getElementById('discard').style.display = containerEl.querySelectorAll('td[data-delta]').length ? 'unset' : 'none';
			}
		});

		const $privTableCon = $('.privilege-table-container');
		$privTableCon.on('click', '[data-action="search.user"]', Privileges.addUserToPrivilegeTable);
		$privTableCon.on('click', '[data-action="search.group"]', Privileges.addGroupToPrivilegeTable);
		$privTableCon.on('click', '[data-action="copyToChildren"]', function () {
			throwConfirmModal('copyToChildren', Privileges.copyPrivilegesToChildren.bind(null, cid, ''));
		});
		$privTableCon.on('click', '[data-action="copyToChildrenGroup"]', function () {
			const groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			throwConfirmModal('copyToChildrenGroup', Privileges.copyPrivilegesToChildren.bind(null, cid, groupName));
		});

		$privTableCon.on('click', '[data-action="copyPrivilegesFrom"]', function () {
			Privileges.copyPrivilegesFromCategory(cid, '');
		});
		$privTableCon.on('click', '[data-action="copyPrivilegesFromGroup"]', function () {
			const groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			Privileges.copyPrivilegesFromCategory(cid, groupName);
		});

		$privTableCon.on('click', '[data-action="copyToAll"]', function () {
			throwConfirmModal('copyToAll', Privileges.copyPrivilegesToAllCategories.bind(null, cid, ''));
		});
		$privTableCon.on('click', '[data-action="copyToAllGroup"]', function () {
			const groupName = $(this).parents('[data-group-name]').attr('data-group-name');
			throwConfirmModal('copyToAllGroup', Privileges.copyPrivilegesToAllCategories.bind(null, cid, groupName));
		});

		$privTableCon.on('click', '.privilege-filters button', filterPrivileges);

		mousetrap.bind('ctrl+s', function (ev) {
			throwConfirmModal('save', Privileges.commit);
			ev.preventDefault();
		});

		function throwConfirmModal(method, onConfirm) {
			const privilegeSubset = getPrivilegeSubset();
			modals.confirm(`[[admin/manage/privileges:alert.confirm-${method}, ${privilegeSubset}]]<br /><br />[[admin/manage/privileges:alert.no-undo]]`, function (ok) {
				if (ok) {
					onConfirm.call();
				}
			});
		}
	};

	Privileges.commit = function () {
		const tableEl = document.querySelector('.privilege-table-container');
		const requests = $.map(tableEl.querySelectorAll('td[data-delta]'), function (el) {
			const privilege = el.getAttribute('data-privilege');
			const rowEl = el.parentNode;
			const member = rowEl.getAttribute('data-group-name') || rowEl.getAttribute('data-uid');
			const state = el.getAttribute('data-delta') === 'true' ? 1 : 0;

			return Privileges.setPrivilege(member, privilege, state);
		});

		Promise.allSettled(requests).then((results) => {
			Privileges.refreshPrivilegeTable();

			const rejects = results.filter(r => r.status === 'rejected');
			if (rejects.length) {
				rejects.forEach((result) => {
					alerts.error(result.reason);
				});
			} else {
				settings.toggleSaveSuccess($('#save'));
			}
		});
	};

	Privileges.discard = function () {
		Privileges.refreshPrivilegeTable();
		alerts.success('[[admin/manage/privileges:alert.discarded]]');
	};

	Privileges.refreshPrivilegeTable = function (groupToHighlight) {
		api.get(`/categories/${cid}/privileges`, {}).then((privileges) => {
			ajaxify.data.privileges = { ...ajaxify.data.privileges, ...privileges };
			const tpl = getPrivilegeTablePartial();
			const isAdminPriv = ajaxify.currentPage.endsWith('admin/manage/privileges/admin');
			app.parseAndTranslate(tpl, { cid, privileges, isAdminPriv }).then((html) => {
				// Get currently selected filters
				const btnIndices = $('.privilege-filters button.btn-warning').map((idx, el) => $(el).index()).get();
				$('.privilege-table-container').html(html);
				Privileges.exposeMixedPrivileges();
				Privileges.exposeAssumedPrivileges();
				document.querySelectorAll('.privilege-filters').forEach((con, i) => {
					const idx = btnIndices[i] === undefined ? 0 : btnIndices[i];
					con.querySelectorAll('button')[idx].click();
				});

				hightlightRowByDataAttr('data-group-name', groupToHighlight);
			});
		}).catch(alert.error);
	};

	Privileges.exposeAssumedPrivileges = function () {
		/*
			If registered-users has a privilege enabled, then all users and groups of that privilege
			should be assumed to have that privilege as well, even if not set in the db, so reflect
			this arrangement in the table
		*/

		// As such, individual banned users inherits privileges from banned-users group
		const getBannedUsersInputSelector = (privs, i) => `.privilege-table tr[data-banned] td[data-privilege="${privs[i]}"] input`;
		const bannedUsersPrivs = getPrivilegesFromRow('banned-users');
		applyPrivileges(bannedUsersPrivs, getBannedUsersInputSelector);

		// For rest that inherits from registered-users
		const getRegisteredUsersInputSelector = (privs, i) => `.privilege-table tr[data-group-name]:not([data-group-name="registered-users"],[data-group-name="banned-users"],[data-group-name="guests"],[data-group-name="spiders"],[data-group-name="fediverse"]) td[data-privilege="${privs[i]}"] input, .privilege-table tr[data-uid]:not([data-banned]) td[data-privilege="${privs[i]}"] input`;
		const registeredUsersPrivs = getPrivilegesFromRow('registered-users');
		applyPrivileges(registeredUsersPrivs, getRegisteredUsersInputSelector);
	};

	Privileges.exposeSingleAssumedPriv = function (columnNo, sourceGroupName) {
		let inputSelectorFn;
		switch (sourceGroupName) {
			case 'banned-users':
				inputSelectorFn = () => `.privilege-table tr[data-banned] td[data-privilege]:nth-child(${columnNo}) input`;
				break;
			default:
				inputSelectorFn = () => `.privilege-table tr[data-group-name]:not([data-group-name="registered-users"],[data-group-name="banned-users"],[data-group-name="guests"],[data-group-name="spiders"],[data-group-name="fediverse"]) td[data-privilege]:nth-child(${columnNo}) input, .privilege-table tr[data-uid]:not([data-banned]) td[data-privilege]:nth-child(${columnNo}) input`;
		}

		const sourceChecked = getPrivilegeFromColumn(sourceGroupName, columnNo);
		applyPrivilegesToColumn(inputSelectorFn, sourceChecked);
	};

	Privileges.setPrivilege = (member, privilege, state) => {
		const targetCid = cid === 'all' ? 'all' : (isNaN(cid) ? 0 : cid);
		return api[state ? 'put' : 'del'](`/categories/${targetCid}/privileges/${encodeURIComponent(privilege)}`, { member });
	};

	Privileges.addUserToPrivilegeTable = async function () {
		const modal = await modals.dialog({
			title: '[[admin/manage/categories:alert.find-user]]',
			message: '<input class="form-control input-lg" placeholder="[[admin/manage/categories:alert.user-search]]" />',
			show: true,
		});

		modal.on('shown.bs.modal', function () {
			const inputEl = modal.find('input');
			inputEl.focus();

			autocomplete.user(inputEl, function (ev, ui) {
				addUserToCategory(ui.item.user, function () {
					modal.modal('hide');
				});
			});
		});
	};

	Privileges.addGroupToPrivilegeTable = async function () {
		const modal = await modals.dialog({
			title: '[[admin/manage/categories:alert.find-group]]',
			message: '<input class="form-control input-lg" placeholder="[[admin/manage/categories:alert.group-search]]" />',
			show: true,
		});

		modal.on('shown.bs.modal', function () {
			const inputEl = modal.find('input');
			inputEl.focus();

			autocomplete.group(inputEl, function (ev, ui) {
				if (ui.item.group.name === 'administrators') {
					return alerts.alert({
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
		if (cid === 'all') {
			return alerts.error('[[admin/manage/privileges:alert.copy-disabled-all]]');
		}
		const filter = getGroupPrivilegeFilter();
		socket.emit('admin.categories.copyPrivilegesToChildren', { cid, group, filter }, function (err) {
			if (err) {
				return alerts.error(err.message);
			}
			alerts.success('[[admin/manage/categories:privileges.copy-success]]');
		});
	};

	Privileges.copyPrivilegesFromCategory = function (cid, group) {
		if (cid === 'all') {
			return alerts.error('[[admin/manage/privileges:alert.copy-disabled-all]]');
		}
		const privilegeSubset = getPrivilegeSubset();
		const message = '<br>' +
			(group ? `[[admin/manage/privileges:alert.copyPrivilegesFromGroup-warning, ${privilegeSubset}]]` :
				`[[admin/manage/privileges:alert.copyPrivilegesFrom-warning, ${privilegeSubset}]]`) +
			'<br><br>[[admin/manage/privileges:alert.no-undo]]';
		categorySelector.modal({
			title: '[[admin/manage/privileges:alert.copyPrivilegesFrom-title]]',
			message,
			localCategories: [],
			showLinks: true,
			onSubmit: function (selectedCategory) {
				socket.emit('admin.categories.copyPrivilegesFrom', {
					toCid: cid,
					filter: getGroupPrivilegeFilter(),
					fromCid: selectedCategory.cid,
					group: group,
				}, function (err) {
					if (err) {
						return alerts.error(err);
					}
					ajaxify.refresh();
				});
			},
		});
	};

	Privileges.copyPrivilegesToAllCategories = function (cid, group) {
		if (cid === 'all') {
			return alerts.error('[[admin/manage/privileges:alert.copy-disabled-all]]');
		}
		const filter = getGroupPrivilegeFilter();
		socket.emit('admin.categories.copyPrivilegesToAllCategories', { cid, group, filter }, function (err) {
			if (err) {
				return alerts.error(err);
			}
			alerts.success('[[admin/manage/categories:privileges.copy-success]]');
		});
	};

	function getPrivilegesFromRow(sourceGroupName) {
		const privs = [];
		$(`.privilege-table tr[data-group-name="${sourceGroupName}"] td input[type="checkbox"]:not(.checkbox-helper)`)
			.parents('[data-privilege]')
			.each(function (idx, el) {
				// `indeterminate` covers the "all categories" mixed state: a source group that
				// holds the privilege in only some categories still confers it to inheritors.
				const input = $(el).find('input').get(0);
				if (input && (input.checked || input.indeterminate)) {
					privs.push(el.getAttribute('data-privilege'));
				}
			});

		// Also apply to non-group privileges
		return privs.concat(privs.map(function (priv) {
			if (priv.startsWith('groups:')) {
				return priv.slice(7);
			}

			return false;
		})).filter(Boolean);
	}

	function getPrivilegeFromColumn(sourceGroupName, columnNo) {
		return $(`.privilege-table tr[data-group-name="${sourceGroupName}"] td:nth-child(${columnNo}) input[type="checkbox"]`)[0].checked;
	}

	function applyPrivileges(privs, inputSelectorFn) {
		for (let x = 0, numPrivs = privs.length; x < numPrivs; x += 1) {
			const inputs = $(inputSelectorFn(privs, x));
			inputs.each(function (idx, el) {
				if (!el.checked) {
					el.indeterminate = true;
				}
			});
		}
	}

	function applyPrivilegesToColumn(inputSelectorFn, sourceChecked) {
		const $inputs = $(inputSelectorFn());
		$inputs.each((idx, el) => {
			el.indeterminate = el.checked ? false : sourceChecked;
		});
	}

	function hightlightRowByDataAttr(attrName, attrValue) {
		if (attrValue) {
			const $el = $('[' + attrName + ']').filter(function () {
				return $(this).attr(attrName) === String(attrValue);
			});

			if ($el.length) {
				$el.addClass('selected');
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
		const groupRow = document.querySelector('.privilege-table [data-group-name="' + group + '"]');
		if (groupRow) {
			hightlightRowByDataAttr('data-group-name', group);
			return cb();
		}
		// Generate data for new row
		const typesMap = {};
		const privilegeSet = ajaxify.data.privileges.keys.groups.reduce(function (memo, cur, index) {
			memo[cur] = false;
			typesMap[cur] = ajaxify.data.privileges.labelData[index].type;
			return memo;
		}, {});

		app.parseAndTranslate(getPrivilegeTablePartial(), 'privileges.groups', {
			privileges: {
				groups: [
					{
						name: group,
						privileges: privilegeSet,
						types: typesMap,
					},
				],
			},
		}, function (html) {
			const tbodyEl = document.querySelector('.privilege-table tbody');
			const btnIdx = $('.privilege-filters').first().find('button.btn-warning').index();
			tbodyEl.append(html.get(0));
			Privileges.exposeAssumedPrivileges();
			hightlightRowByDataAttr('data-group-name', group);
			if (btnIdx >= 0) {
				document.querySelector('.privilege-filters').querySelectorAll('button')[btnIdx].click();
			}
			cb();
		});
	}

	async function addUserToCategory(user, cb) {
		cb = cb || function () {};
		const userRow = document.querySelector('.privilege-table [data-uid="' + user.uid + '"]');
		if (userRow) {
			hightlightRowByDataAttr('data-uid', user.uid);
			return cb();
		}
		// Generate data for new row
		const typesMap = {};
		const privilegeSet = ajaxify.data.privileges.keys.users.reduce(function (memo, cur, index) {
			memo[cur] = false;
			typesMap[cur] = ajaxify.data.privileges.labelData[index].type;
			return memo;
		}, {});

		const html = await app.parseAndTranslate(getPrivilegeTablePartial(), 'privileges.users', {
			privileges: {
				users: [
					{
						picture: user.picture,
						username: user.username,
						banned: user.banned,
						uid: user.uid,
						'icon:text': user['icon:text'],
						'icon:bgColor': user['icon:bgColor'],
						privileges: privilegeSet,
						types: typesMap,
					},
				],
			},
		});

		const tbodyEl = document.querySelectorAll('.privilege-table tbody');
		const btnIdx = $('.privilege-filters').last().find('button.btn-warning').index();
		tbodyEl[1].append(html.get(0));
		Privileges.exposeAssumedPrivileges();
		hightlightRowByDataAttr('data-uid', user.uid);
		if (btnIdx >= 0) {
			document.querySelectorAll('.privilege-filters')[1].querySelectorAll('button')[btnIdx].click();
		}
		cb();
	}

	function filterPrivileges(ev) {
		const btn = $(ev.target);
		const filter = btn.attr('data-filter');
		const rows = btn.closest('table').find('thead tr:last-child, tbody tr');
		rows.each((i, tr) => {
			$(tr).find('[data-type]').addClass('hidden');
			$(tr).find(`[data-type="${filter}"]`).removeClass('hidden');
		});

		checkboxRowSelector.updateAll();
		btn.siblings('button').removeClass('btn-warning');
		btn.addClass('btn-warning');
	}

	function getGroupPrivilegeFilter() {
		return $('[component="privileges/groups/filters"] .btn-warning').attr('data-filter');
	}

	function getPrivilegeSubset() {
		const currentPrivFilter = document.querySelector('.privilege-filters .btn-warning');
		const filterText = currentPrivFilter ? currentPrivFilter.textContent.toLocaleLowerCase() : '';
		return filterText.indexOf('privileges') > -1 ? filterText : `${filterText} privileges`.trim();
	}

	return Privileges;
});
