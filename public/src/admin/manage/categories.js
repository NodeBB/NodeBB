'use strict';

define('admin/manage/categories', [
	'translator',
	'benchpress',
	'categorySelector',
	'api',
	'Sortable',
	'bootbox',
	'alerts',
], function (translator, Benchpress, categorySelector, api, Sortable, bootbox, alerts) {
	Sortable = Sortable.default;
	const Categories = {};
	let newCategoryId = -1;
	let sortables;

	Categories.init = function () {
		categorySelector.init($('[component="category-selector"]'), {
			parentCid: ajaxify.data.selectedCategory ? ajaxify.data.selectedCategory.cid : 0,
			onSelect: function (selectedCategory) {
				ajaxify.go('/admin/manage/categories' + (selectedCategory.cid ? '?cid=' + selectedCategory.cid : ''));
			},
			cacheList: false,
			localCategories: [],
			template: 'admin/partials/category/selector-dropdown-right',
		});
		Categories.render(ajaxify.data.categoriesTree);

		$('button[data-action="create"]').on('click', Categories.throwCreateModal);
		$('button[data-action="add"]').on('click', Categories.throwAddModal);

		// Enable/Disable toggle events
		$('.categories').on('click', '.category-tools [data-action="toggle"]', function () {
			const $this = $(this);
			const cid = $this.attr('data-disable-cid');
			const parentEl = $this.parents('li[data-cid="' + cid + '"]');
			const disabled = parentEl.hasClass('disabled');
			const childrenEls = parentEl.find('li[data-cid]');
			const childrenCids = childrenEls.map(function () {
				return $(this).attr('data-cid');
			}).get();

			Categories.toggle([cid].concat(childrenCids), !disabled);
		});

		$('.categories').on('click', '.toggle', function () {
			const el = $(this);
			el.find('i').toggleClass('fa-chevron-down').toggleClass('fa-chevron-right');
			el.closest('[data-cid]').find('> ul[data-cid]').toggleClass('hidden');
			const hasMoreEl = el.closest('[data-cid]').find('> ul.has-more-categories');
			if (parseInt(hasMoreEl.attr('data-hasmore'), 10) === 1) {
				hasMoreEl.toggleClass('hidden');
			}
		});

		$('.categories').on('click', '.set-order', function () {
			const cid = $(this).attr('data-cid');
			const order = $(this).attr('data-order');
			const modal = bootbox.dialog({
				title: '[[admin/manage/categories:set-order]]',
				message: '<input type="number" min="1" class="form-control input-lg" value=' + order + ' /><p class="form-text">[[admin/manage/categories:set-order-help]]</p>',
				show: true,
				buttons: {
					save: {
						label: '[[modules:bootbox.confirm]]',
						className: 'btn-primary',
						callback: function () {
							const val = modal.find('input').val();
							if (val && cid) {
								const modified = {};
								modified[cid] = { order: Math.max(1, parseInt(val, 10)) };
								api.put('/categories/' + encodeURIComponent(cid), modified[cid]).then(function () {
									ajaxify.refresh();
								}).catch(alerts.error);
							} else {
								return false;
							}
						},
					},
				},
			});
		});

		$('.categories').on('click', 'a[data-action]', function () {
			const action = this.getAttribute('data-action');

			switch (action) {
				case 'remove': {
					Categories.remove.call(this);
					break;
				}

				case 'rename': {
					Categories.rename.call(this);
					break;
				}
			}
		});

		$('#toggle-collapse-all').on('click', function () {
			const $this = $(this);
			const isCollapsed = parseInt($this.attr('data-collapsed'), 10) === 1;
			toggleAll(isCollapsed);
			$this.attr('data-collapsed', isCollapsed ? 0 : 1)
				.translateText(isCollapsed ?
					'[[admin/manage/categories:collapse-all]]' :
					'[[admin/manage/categories:expand-all]]');
		});

		function toggleAll(expand) {
			const el = $('.categories .toggle');
			el.find('i').toggleClass('fa-chevron-down', expand).toggleClass('fa-chevron-right', !expand);
			el.closest('[data-cid]').find('> ul[data-cid]').toggleClass('hidden', !expand);
		}
	};

	Categories.throwCreateModal = function () {
		Benchpress.render('admin/partials/categories/create', {}).then(function (html) {
			const modal = bootbox.dialog({
				title: '[[admin/manage/categories:alert.create]]',
				message: html,
				buttons: {
					save: {
						label: '[[global:create]]',
						className: 'btn-primary',
						callback: submit,
					},
				},
			});
			const options = {
				localCategories: [
					{
						cid: 0,
						name: '[[admin/manage/categories:parent-category-none]]',
						icon: 'fa-none',
					},
				],
				template: 'admin/partials/category/selector-dropdown-left',
			};
			const parentSelector = categorySelector.init(modal.find('#parentCidGroup [component="category-selector"]'), options);
			const cloneFromSelector = categorySelector.init(modal.find('#cloneFromCidGroup [component="category-selector"]'), options);
			function submit() {
				const formData = modal.find('form').serializeObject();
				formData.description = '';
				formData.icon = 'fa-comments';
				formData.uid = app.user.uid;
				formData.parentCid = parentSelector.getSelectedCid();
				formData.cloneFromCid = cloneFromSelector.getSelectedCid();

				Categories.create(formData);
				modal.modal('hide');
				return false;
			}

			$('#cloneChildren').on('change', function () {
				const check = $(this);
				const parentSelect = modal.find('#parentCidGroup [component="category-selector"] .dropdown-toggle');

				if (check.prop('checked')) {
					parentSelect.attr('disabled', 'disabled');
					parentSelector.selectCategory(0);
				} else {
					parentSelect.removeAttr('disabled');
				}
			});

			modal.find('form').on('submit', submit);
		});
	};

	Categories.throwAddModal = function () {
		Benchpress.render('admin/partials/categories/add', {}).then(function (html) {
			const modal = bootbox.dialog({
				title: '[[admin/manage/categories:alert.add]]',
				message: html,
				buttons: {
					save: {
						label: '[[global:save]]',
						className: 'btn-primary',
						callback: submit,
					},
				},
			});

			function submit() {
				const formData = modal.find('form').serializeObject();
				api.post('/api/admin/manage/categories', formData).then(() => {
					ajaxify.refresh();
					modal.modal('hide');
				}).catch(alerts.error);
				return false;
			}

			modal.find('form').on('submit', submit);
		});
	};

	Categories.remove = function () {
		bootbox.confirm('[[admin/manage/categories:alert.confirm-remove]]', (ok) => {
			if (ok) {
				const cid = this.getAttribute('data-cid');
				api.del(`/api/admin/manage/categories/${encodeURIComponent(cid)}`).then(ajaxify.refresh);
			}
		});
	};

	Categories.rename = function () {
		bootbox.prompt({
			title: '[[admin/manage/categories:alert.rename]]',
			message: '<p class="mb-3">[[admin/manage/categories:alert.rename-help]]</p>',
			callback: (name) => {
				const cid = this.getAttribute('data-cid');
				api.post(`/api/admin/manage/categories/${encodeURIComponent(cid)}/name`, { name }).then(ajaxify.refresh);
			},
		});
	};

	Categories.create = function (payload) {
		api.post('/categories', payload, function (err, data) {
			if (err) {
				return alerts.error(err);
			}

			alerts.alert({
				alert_id: 'category_created',
				title: '[[admin/manage/categories:alert.created]]',
				message: '[[admin/manage/categories:alert.create-success]]',
				type: 'success',
				timeout: 2000,
			});

			ajaxify.go('admin/manage/categories/' + data.cid);
		});
	};

	Categories.render = function (categories) {
		const container = $('.categories');

		if (!categories || !categories.length) {
			translator.translate('[[admin/manage/categories:alert.none-active]]', function (text) {
				$('<div></div>')
					.addClass('alert alert-info text-center')
					.text(text)
					.appendTo(container);
			});
		} else {
			sortables = {};
			renderList(categories, container, { cid: 0 });
		}
	};

	Categories.toggle = function (cids, disabled) {
		const listEl = document.querySelector('.categories [data-cid="0"]');
		Promise.all(cids.map(cid => api.put('/categories/' + encodeURIComponent(cid), {
			disabled: disabled ? 1 : 0,
		}).then(() => {
			const categoryEl = listEl.querySelector(`li[data-cid="${cid}"]`);
			categoryEl.classList[disabled ? 'add' : 'remove']('disabled');
			$(categoryEl).find('li a[data-action="toggle"]').first().translateText(disabled ? '[[admin/manage/categories:enable]]' : '[[admin/manage/categories:disable]]');
		}).catch(alerts.error)));
	};

	function itemDidAdd(e) {
		newCategoryId = e.to.dataset.cid;
	}

	function itemDragDidEnd(e) {
		const isCategoryUpdate = parseInt(newCategoryId, 10) !== -1;

		// Update needed?
		if ((e.newIndex != null && parseInt(e.oldIndex, 10) !== parseInt(e.newIndex, 10)) || isCategoryUpdate) {
			const cid = e.item.dataset.cid;
			const modified = {};
			// on page 1 baseIndex is 0, on page n baseIndex is (n - 1) * ajaxify.data.categoriesPerPage
			// this makes sure order is correct when drag & drop is used on pages > 1
			const baseIndex = (ajaxify.data.pagination.currentPage - 1) * ajaxify.data.categoriesPerPage;
			modified[cid] = {
				order: baseIndex + e.newIndex + 1,
			};

			if (isCategoryUpdate) {
				modified[cid].parentCid = newCategoryId;

				// Show/hide expand buttons after drag completion
				const oldParentCid = parseInt(e.from.getAttribute('data-cid'), 10);
				const newParentCid = parseInt(e.to.getAttribute('data-cid'), 10);
				if (oldParentCid !== newParentCid) {
					const toggle = document.querySelector(`.categories li[data-cid="${newParentCid}"] .toggle`);
					if (toggle) {
						toggle.classList.toggle('invisible', false);
					}

					const children = document.querySelectorAll(`.categories li[data-cid="${oldParentCid}"] ul[data-cid] li[data-cid]`);
					if (!children.length) {
						const toggle = document.querySelector(`.categories li[data-cid="${oldParentCid}"] .toggle`);
						if (toggle) {
							toggle.classList.toggle('invisible', true);
						}
					}

					e.item.dataset.parentCid = newParentCid;
				}
			}

			newCategoryId = -1;
			api.put('/categories/' + encodeURIComponent(cid), modified[cid]).catch(alerts.error);
		}
	}

	/**
	 * Render categories - recursively
	 *
	 * @param categories {array} categories tree
	 * @param level {number} current sub-level of rendering
	 * @param container {object} parent jquery element for the list
	 * @param parentId {number} parent category identifier
	 */
	function renderList(categories, container, parentCategory) {
		// Translate category names if needed
		let count = 0;
		const parentId = parentCategory.cid;
		categories.forEach(function (category, idx, parent) {
			translator.translate(category.name, function (translated) {
				if (category.name !== translated) {
					category.name = translated;
				}
				count += 1;

				if (count === parent.length) {
					continueRender();
				}
			});
		});

		if (!categories.length) {
			continueRender();
		}

		function continueRender() {
			app.parseAndTranslate('admin/partials/categories/category-rows', {
				cid: parentCategory.cid,
				categories: categories,
				parentCategory: parentCategory,
			}, function (html) {
				if (container.find('.category-row').length) {
					container.find('.category-row').after(html);
				} else {
					container.append(html);
				}

				// Disable expand toggle
				if (!categories.length) {
					const toggleEl = container.get(0).querySelector('.toggle');
					toggleEl.classList.toggle('invisible', true);
				}

				// Handle and children categories in this level have
				for (let x = 0, numCategories = categories.length; x < numCategories; x += 1) {
					renderList(categories[x].children, $('li[data-cid="' + categories[x].cid + '"]'), categories[x]);
				}

				// Make list sortable
				sortables[parentId] = Sortable.create($('ul[data-cid="' + parentId + '"]')[0], {
					group: 'cross-categories',
					animation: 150,
					handle: '.information',
					dataIdAttr: 'data-cid',
					ghostClass: 'placeholder',
					onAdd: itemDidAdd,
					onEnd: itemDragDidEnd,
				});
			});
		}
	}

	return Categories;
});
