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
		categorySelector.init($('.category [component="category-selector"]'), {
			parentCid: ajaxify.data.selectedCategory ? ajaxify.data.selectedCategory.cid : 0,
			onSelect: function (selectedCategory) {
				ajaxify.go('/admin/manage/categories' + (selectedCategory.cid ? '?cid=' + selectedCategory.cid : ''));
			},
			localCategories: [],
		});
		Categories.render(ajaxify.data.categoriesTree);

		$('button[data-action="create"]').on('click', Categories.throwCreateModal);

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
			el.find('i').toggleClass('fa-minus').toggleClass('fa-plus');
			el.closest('[data-cid]').find('> ul[data-cid]').toggleClass('hidden');
		});

		$('.categories').on('click', '.set-order', function () {
			const cid = $(this).attr('data-cid');
			const order = $(this).attr('data-order');
			const modal = bootbox.dialog({
				title: '[[admin/manage/categories:set-order]]',
				message: '<input type="number" min="1" class="form-control input-lg" value=' + order + ' /><p class="help-block">[[admin/manage/categories:set-order-help]]</p>',
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
								api.put('/categories/' + cid, modified[cid]).then(function () {
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

		$('#collapse-all').on('click', function () {
			toggleAll(false);
		});

		$('#expand-all').on('click', function () {
			toggleAll(true);
		});

		function toggleAll(expand) {
			const el = $('.categories .toggle');
			el.find('i').toggleClass('fa-minus', expand).toggleClass('fa-plus', !expand);
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
						label: '[[global:save]]',
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
			renderList(categories, container, 0);
		}
	};

	Categories.toggle = function (cids, disabled) {
		const listEl = document.querySelector('.categories ul');
		Promise.all(cids.map(cid => api.put('/categories/' + cid, {
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
			}

			newCategoryId = -1;
			api.put('/categories/' + cid, modified[cid]).catch(alerts.error);
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
	function renderList(categories, container, parentId) {
		// Translate category names if needed
		let count = 0;
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
				cid: parentId,
				categories: categories,
			}, function (html) {
				container.append(html);

				// Handle and children categories in this level have
				for (let x = 0, numCategories = categories.length; x < numCategories; x += 1) {
					renderList(categories[x].children, $('li[data-cid="' + categories[x].cid + '"]'), categories[x].cid);
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
