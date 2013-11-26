define(function() {
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
			socket.emit('api:admin.categories.update', modified_categories);
			modified_categories = {};
		}

		function select_icon(el) {
			var selected = el.attr('class').replace(' fa-2x', '');
			jQuery('#icons .selected').removeClass('selected');
			if (selected)
				jQuery('#icons .' + selected).parent().addClass('selected');


			bootbox.confirm('<h2>Select an icon.</h2>' + document.getElementById('icons').innerHTML, function(confirm) {
				if (confirm) {
					var iconClass = jQuery('.bootbox .selected').children(':first').attr('class');

					el.attr('class', iconClass + ' fa-2x');

					// remove the 'fa ' from the class name, just need the icon name itself
					var categoryIconClass = iconClass.replace('fa ', '');
					el.val(categoryIconClass);
					el.attr('value', categoryIconClass);

					modified(el);
				}
			});

			setTimeout(function() { //bootbox was rewritten for BS3 and I had to add this timeout for the previous code to work. TODO: to look into
				jQuery('.bootbox .col-md-3').on('click', function() {
					jQuery('.bootbox .selected').removeClass('selected');
					jQuery(this).addClass('selected');
				});
			}, 500);
		}


		function update_blockclass(el) {
			el.parentNode.parentNode.className = 'entry-row ' + el.value;
		}

		function updateCategoryOrders() {
			var categories = $('.admin-categories #entry-container').children();
			for(var i=0; i<categories.length; ++i) {
				var input = $(categories[i]).find('input[data-name="order"]');

				input.val(i+1).attr('data-value', i+1);
				modified(input);
			}
		}

		jQuery('#entry-container').sortable({
			stop: function( event, ui ) {
				updateCategoryOrders();
			}
		});
		jQuery('.blockclass').each(function() {
			jQuery(this).val(this.getAttribute('data-value'));
		});


		function showCreateCategoryModal() {
			$('#new-category-modal').modal();
		}

		function createNewCategory() {
			var category = {
				name: $('#inputName').val(),
				description: $('#inputDescription').val(),
				icon: $('#new-category-modal i').val(),
				blockclass: $('#inputBlockclass').val()
			};

			socket.emit('api:admin.categories.create', category, function(err, data) {
				if (!err) {
					app.alert({
						alert_id: 'category_created',
						title: 'Created',
						message: 'Category successfully created!',
						type: 'success',
						timeout: 2000
					});

					var html = templates.prepare(templates['admin/categories'].blocks['categories']).parse({
						categories: [data]
					});
					$('#entry-container').append(html);

					$('#new-category-modal').modal('hide');
				}
			});
		}

		jQuery('document').ready(function() {
			var url = window.location.href,
				parts = url.split('/'),
				active = parts[parts.length - 1];

			jQuery('.nav-pills li').removeClass('active');
			jQuery('.nav-pills li a').each(function() {
				if (this.getAttribute('href').match(active)) {
					jQuery(this.parentNode).addClass('active');
					return false;
				}
			});

			jQuery('#save').on('click', save);
			jQuery('#addNew').on('click', showCreateCategoryModal);
			jQuery('#create-category-btn').on('click', createNewCategory);

			jQuery('#entry-container').on('click', '.icon', function(ev) {
				select_icon($(this).find('i'));
			});

			jQuery('#new-category-modal').on('click', '.icon', function(ev) {
				select_icon($(this).find('i'));
			});

			jQuery('.blockclass').on('change', function(ev) {
				update_blockclass(ev.target);
			});

			jQuery('.category_name, .category_description, .blockclass .category_bgColor').on('change', function(ev) {
				modified(ev.target);
			});

			jQuery('.entry-row button').each(function(index, element) {
				var disabled = $(element).attr('data-disabled');
				if (disabled == "0" || disabled == "")
					$(element).html('Disable');
				else
					$(element).html('Enable');

			});

			jQuery('#entry-container').on('click', '.disable-btn', function(ev) {
				var btn = jQuery(this);
				var categoryRow = btn.parents('li');
				var cid = categoryRow.attr('data-cid');

				var disabled = btn.html() == "Disable" ? "1" : "0";
				categoryRow.remove();
				modified_categories[cid] = modified_categories[cid] || {};
				modified_categories[cid]['disabled'] = disabled;

				save();
				return false;
			});

			// Colour Picker
			$('[data-name="bgColor"], [data-name="color"]').each(function(idx, inputEl) {
				var	jinputEl = $(this),
					parentEl = jinputEl.parents('[data-cid]');
				jinputEl.ColorPicker({
					color: this.value || '#000',
					onChange: function(hsb, hex) {
						jinputEl.val('#' + hex);
						if (inputEl.getAttribute('data-name') === 'bgColor') parentEl.css('background', '#' + hex);
						else if (inputEl.getAttribute('data-name') === 'color') parentEl.css('color', '#' + hex);
						modified(inputEl);
					}
				});
			});
		});
	};

	return Categories;
});