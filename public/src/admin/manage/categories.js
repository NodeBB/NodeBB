"use strict";
/*global define, socket, app, bootbox, templates, ajaxify, RELATIVE_PATH*/

define('admin/manage/categories', function() {
	var	Categories = {}, newCategoryId = -1, sortables;

	Categories.init = function() {
		socket.emit('admin.categories.getAll', function(error, payload){
			if(error){
				return app.alertError(error.message);
			}

			Categories.render(payload);
		});

		$('button[data-action="create"]').on('click', Categories.create);
	};

	Categories.create = function() {
		bootbox.prompt('Category Name', function(name) {
			if (!name) {
				return;
			}

			socket.emit('admin.categories.create', {
				name: name,
				description: '',
				icon: 'fa-comments'
			}, function(err, data) {
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

				ajaxify.go('admin/manage/categories/' + data.cid);
			});
		});
	};

	Categories.render = function(categories){
        var container = $('.categories');

        if(!categories || categories.length == 0){
            $('<div></div>')
                .addClass('alert alert-info text-center')
                .text('You have no active categories.')
                .appendTo(container);
        }else{
            sortables = {};
            renderList(categories, 0, container, 0);
        }
	};

	function itemDidAdd(e){
        newCategoryId = e.to.dataset.cid;
	}

	function itemDragDidEnd(e){
        var isCategoryUpdate = (newCategoryId != -1);
		//Update needed?
		if((e.newIndex != undefined && e.oldIndex != e.newIndex) || isCategoryUpdate){
            var parentCategory = isCategoryUpdate ? sortables[newCategoryId] : sortables[e.from.dataset.cid],
                modified = {}, i = 0, list = parentCategory.toArray(), len = list.length;

            for(i; i < len; ++i) {
                modified[list[i]] = {
                    order: (i + 1)
                }
            }

            if(isCategoryUpdate){
                modified[e.item.dataset.cid]['parentCid'] = newCategoryId;
            }

            newCategoryId = -1
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
    function renderList(categories, level, container, parentId){
        var i = 0, len = categories.length, category, marginLeft = 48, listItem;
        var list = $('<ul />', {'data-cid': parentId});

		if(level > 0){
			list.css('margin-left', marginLeft);
		}

        for(i; i < len; ++i){
            category = categories[i];

             listItem = $('<li></li>', {'data-cid': category.cid})
                 .append(renderListItem(category))
                 .appendTo(list);

            if(category.disabled){
                listItem.addClass('disabled');
            }

            if(category.children.length > 0){
                renderList(category.children, level + 1, listItem, category.cid);
            }
        }

        list.appendTo(container);
		sortables[parentId] = Sortable.create(list[0], {
			group: 'cross-categories',
			animation: 150,
			handle: '.icon',
            dataIdAttr: 'data-cid',
			ghostClass: "placeholder",
			onAdd: itemDidAdd,
			onEnd: itemDragDidEnd
		});
    }

    function renderListItem(categoryEntity){
        var listItem = $(templates.parse(
            '<div class="row">' +
				'<div class="col-md-9">' +
					'<div class="clearfix">' +
						'<div class="icon">' +
							'<i data-name="icon" value="{icon}" class="fa {icon}"></i>' +
						'</div>' +
						'<div class="information">' +
							'<h5 class="header">{name}</h5>' +
							'<p class="description">{description}</p>' +
						'</div>' +
					'</div>' +
				'</div>' +
				'<div class="col-md-3">' +
					'<div class="clearfix pull-right">' +
						'<ul class="fa-ul stats">' +
							'<li class="fa-li"><i class="fa fa-book"></i> {topic_count}</li>' +
							'<li class="fa-li"><i class="fa fa-pencil"></i> {post_count}</li>' +
						'</ul>' +
						'<div class="btn-group">' +
							'<button data-action="toggle" data-disabled="{disabled}" class="btn btn-xs"></button>' +
							'<a href="./categories/{cid}" class="btn btn-default btn-xs">Edit</a>' +
						'</div>' +
					'</div>' +
				'</div>' +
			'</div>',
            categoryEntity
        ));

		var icon = listItem.find('.icon'),
			button = listItem.find('[data-action="toggle"]');

		if(categoryEntity.backgroundImage){
			icon.css('background-image', 'url(' + categoryEntity.backgroundImage + ')');
		}

		icon
			.css('color', categoryEntity.color)
			.css('background-color', categoryEntity.bgColor);

		if(categoryEntity.disabled){
			button.text('Enable').addClass('btn-success');
		}else{
			button.text('Disable').addClass('btn-danger');
		}

		// Category enable/disable
		button.on('click', function(e) {
			var payload = {};

			payload[categoryEntity.cid] = {
				disabled: !categoryEntity.disabled | 0
			};

			socket.emit('admin.categories.update', payload, function(err, result) {
				if (err) {
					return app.alertError(err.message);
				} else {
					ajaxify.refresh();
				}
			});
		});

        return listItem;
    }

	return Categories;
});