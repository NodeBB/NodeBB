'use strict';


define('admin/manage/categories', ['vendor/jquery/serializeObject/jquery.ba-serializeobject.min', 'translator', 'benchpress'], function (serialize, translator, Benchpress) {
	var	Categories = {};
	var newCategoryId = -1;
	var sortables;

	Categories.init = function () {
		socket.emit('admin.categories.getAll', function (error, payload) {
			if (error) {
				return app.alertError(error.message);
			}

			Categories.render(payload);
		});

		$('button[data-action="create"]').on('click', Categories.throwCreateModal);

		// Enable/Disable toggle events
		$('.categories').on('click', 'button[data-action="toggle"]', function () {
			var $this = $(this);
			var cid = $this.attr('data-cid');
			var parentEl = $this.parents('li[data-cid="' + cid + '"]');
			var disabled = parentEl.hasClass('disabled');

			var children = parentEl.find('li[data-cid]').map(function () {
				return $(this).attr('data-cid');
			}).get();

			Categories.toggle([cid].concat(children), !disabled);
			return false;
		});

		$('.categories').on('click', '.toggle', function () {
			var el = $(this);
			el.find('i').toggleClass('fa-minus').toggleClass('fa-plus');
			el.closest('[data-cid]').find('> ul[data-cid]').toggleClass('hidden');
		});

		$('#collapse-all').on('click', function () {
			toggleAll(false);
		});

		$('#expand-all').on('click', function () {
			toggleAll(true);
		});

		function toggleAll(expand) {
			var el = $('.categories .toggle');
			el.find('i').toggleClass('fa-minus', expand).toggleClass('fa-plus', !expand);
			el.closest('[data-cid]').find('> ul[data-cid]').toggleClass('hidden', !expand);
		}
	};

	Categories.throwCreateModal = function () {
		socket.emit('admin.categories.getNames', {}, function (err, categories) {
			if (err) {
				return app.alertError(err.message);
			}

			Benchpress.parse('admin/partials/categories/create', {
				categories: categories,
			}, function (html) {
				var modal = bootbox.dialog({
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

				function submit() {
					var formData = modal.find('form').serializeObject();
					formData.description = '';
					formData.icon = 'fa-comments';
					formData.uid = app.user.uid;

					Categories.create(formData);
					modal.modal('hide');
					return false;
				}

				$('#cloneChildren').on('change', function () {
					var check = $(this);
					var parentSelect = $('#parentCid');

					if (check.prop('checked')) {
						parentSelect.attr('disabled', 'disabled');
						parentSelect.val('');
					} else {
						parentSelect.removeAttr('disabled');
					}
				});

				modal.find('form').on('submit', submit);
			});
		});
	};

	Categories.create = function (payload) {
		socket.emit('admin.categories.create', payload, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			app.alert({
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
		var container = $('.categories');

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
		var payload = {};

		cids.forEach(function (cid) {
			payload[cid] = {
				disabled: disabled ? 1 : 0,
			};
		});

		socket.emit('admin.categories.update', payload, function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			ajaxify.refresh();
		});
	};

	function itemDidAdd(e) {
		newCategoryId = e.to.dataset.cid;
	}

	function itemDragDidEnd(e) {
		var isCategoryUpdate = parseInt(newCategoryId, 10) !== -1;

		// Update needed?
		if ((e.newIndex != null && parseInt(e.oldIndex, 10) !== parseInt(e.newIndex, 10)) || isCategoryUpdate) {
			var parentCategory = isCategoryUpdate ? sortables[newCategoryId] : sortables[e.from.dataset.cid];
			var modified = {};
			var i = 0;
			var list = parentCategory.toArray();
			var len = list.length;

			for (i; i < len; i += 1) {
				modified[list[i]] = {
					order: (i + 1),
				};
			}

			if (isCategoryUpdate) {
				modified[e.item.dataset.cid].parentCid = newCategoryId;
			}

			newCategoryId = -1;
			socket.emit('admin.categories.update', modified);
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
		var count = 0;
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
			Benchpress.parse('admin/partials/categories/category-rows', {
				cid: parentId,
				categories: categories,
			}, function (html) {
				translator.translate(html, function (html) {
					container.append(html);

					// Handle and children categories in this level have
					for (var x = 0, numCategories = categories.length; x < numCategories; x += 1) {
						renderList(categories[x].children, $('li[data-cid="' + categories[x].cid + '"]'), categories[x].cid);
					}

					// Make list sortable
					sortables[parentId] = Sortable.create($('ul[data-cid="' + parentId + '"]')[0], {
						group: 'cross-categories',
						animation: 150,
						handle: '.icon',
						dataIdAttr: 'data-cid',
						ghostClass: 'placeholder',
						onAdd: itemDidAdd,
						onEnd: itemDragDidEnd,
					});
				});
			});
		}
	}

	return Categories;
});
