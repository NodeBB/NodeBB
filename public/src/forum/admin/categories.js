define(['uploader'], function(uploader) {
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
			socket.emit('admin.categories.update', modified_categories);
			modified_categories = {};
		}

		function select_icon(el) {
			var selected = el.attr('class').replace(' fa-2x', '');
			$('#icons .selected').removeClass('selected');
			if (selected)
				$('#icons .' + selected).parent().addClass('selected');


			bootbox.confirm('<h2>Select an icon.</h2>' + document.getElementById('icons').innerHTML, function(confirm) {
				if (confirm) {
					var iconClass = $('.bootbox .selected').children(':first').attr('class');

					el.attr('class', iconClass + ' fa-2x');

					// remove the 'fa ' from the class name, just need the icon name itself
					var categoryIconClass = iconClass.replace('fa ', '');
					el.val(categoryIconClass);
					el.attr('value', categoryIconClass);

					modified(el);
				}
			});

			setTimeout(function() { //bootbox was rewritten for BS3 and I had to add this timeout for the previous code to work. TODO: to look into
				$('.bootbox .col-md-3').on('click', function() {
					$('.bootbox .selected').removeClass('selected');
					$(this).addClass('selected');
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

		$('#entry-container').sortable({
			stop: function( event, ui ) {
				updateCategoryOrders();
			}
		});
		$('.blockclass').each(function() {
			$(this).val(this.getAttribute('data-value'));
		});


		function showCreateCategoryModal() {
			$('#new-category-modal').modal();
		}

		function createNewCategory() {
			var category = {
				name: $('#inputName').val(),
				description: $('#inputDescription').val(),
				icon: $('#new-category-modal i').val(),
				bgColor: '#0059b2',
				color: '#fff',
				order: $('.admin-categories #entry-container').children().length + 1
			};

			socket.emit('admin.categories.create', category, function(err, data) {
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

		$('document').ready(function() {
			var url = window.location.href,
				parts = url.split('/'),
				active = parts[parts.length - 1];

			$('.nav-pills li').removeClass('active');
			$('.nav-pills li a').each(function() {
				if (this.getAttribute('href').match(active)) {
					$(this.parentNode).addClass('active');
					return false;
				}
			});

			$('#save').on('click', save);
			$('#addNew').on('click', showCreateCategoryModal);
			$('#create-category-btn').on('click', createNewCategory);

			$('#entry-container').on('click', '.icon', function(ev) {
				select_icon($(this).find('i'));
			});

			$('#new-category-modal').on('click', '.icon', function(ev) {
				select_icon($(this).find('i'));
			});

			$('.admin-categories form input').on('change', function(ev) {
				modified(ev.target);
			});

			$('.dropdown li[data-disabled]').each(function(index, element) {
				var disabled = $(element).attr('data-disabled');
				if (disabled == "0" || disabled == "") {
					$(element).html('<a href="#"><i class="fa fa-power-off"></i> Disable</a>');
				} else {
					$(element).html('<a href="#"><i class="fa fa-power-off"></i> Enable</a>');
				}
			});

			$('.dropdown').on('click', '[data-disabled]', function(ev) {
				var btn = $(this);
				var categoryRow = btn.parents('li');
				var cid = categoryRow.attr('data-cid');

				var disabled = this.getAttribute('data-disabled') === '0' ? '1' : '0';
				categoryRow.remove();
				modified_categories[cid] = modified_categories[cid] || {};
				modified_categories[cid]['disabled'] = disabled;

				save();
				return false;
			});

			// Colour Picker
			$('[data-name="bgColor"], [data-name="color"]').each(function(idx, inputEl) {
				var	jinputEl = $(this),
					previewEl = jinputEl.parents('[data-cid]').find('.preview-box');

				jinputEl.ColorPicker({
					color: this.value || '#000',
					onChange: function(hsb, hex) {
						jinputEl.val('#' + hex);
						if (inputEl.getAttribute('data-name') === 'bgColor') previewEl.css('background', '#' + hex);
						else if (inputEl.getAttribute('data-name') === 'color') previewEl.css('color', '#' + hex);
						modified(inputEl);
					}
				});
			});

			// Permissions modal
			$('.permissions').on('click', function() {
				var	cid = $(this).parents('li[data-cid]').attr('data-cid');
				Categories.launchPermissionsModal(cid);
			});


			$('.upload-button').on('click', function() {
				var inputEl = this;
				var	cid = $(this).parents('li[data-cid]').attr('data-cid');
				uploader.open(RELATIVE_PATH + '/admin/category/uploadpicture', {cid:cid}, function(imageUrlOnServer) {
					inputEl.value = imageUrlOnServer;
					var previewBox = $(inputEl).parents('li[data-cid]').find('.preview-box');
					previewBox.css('background', 'url(' + imageUrlOnServer + '?' + new Date().getTime() + ')')
						.css('background-size', 'cover');
					modified(inputEl);
				});
			});

			$('.admin-categories').delegate('.delete-image', 'click', function() {
				var parent = $(this).parents('li[data-cid]'),
					inputEl = parent.find('.upload-button'),
					preview = parent.find('.preview-box'),
					bgColor = parent.find('.category_bgColor').val();

				inputEl.value = '';
				modified(inputEl);

				preview.css('background', bgColor);

				$(this).hide();
			});
		});
	};

	Categories.launchPermissionsModal = function(cid) {
		var	modal = $('#category-permissions-modal'),
			searchEl = modal.find('#permission-search'),
			resultsEl = modal.find('.search-results'),
			groupsResultsEl = modal.find('.groups-results'),
			searchDelay;

		searchEl.off().on('keyup', function() {
			var	searchEl = this,
				resultsFrag = document.createDocumentFragment(),
				liEl = document.createElement('li');
			clearTimeout(searchDelay);

			searchDelay = setTimeout(function() {
				socket.emit('admin.categories.search', {
					username: searchEl.value,
					cid: cid
				}, function(err, results) {
					var	numResults = results.length,
						resultObj;
					for(var x=0;x<numResults;x++) {
						resultObj = results[x];

						liEl.setAttribute('data-uid', resultObj.uid);
						liEl.innerHTML =	'<div class="pull-right">' +
												'<div class="btn-group">' +
													'<button type="button" data-priv="+r" class="btn btn-default' + (resultObj.privileges['+r'] ? ' active' : '') + '">Read</button>' +
													'<button type="button" data-priv="+w" class="btn btn-default' + (resultObj.privileges['+w'] ? ' active' : '') + '">Write</button>' +
												'</div>' +
											'</div>' +
											'<img src="' + resultObj.picture + '" /> ' + resultObj.username;

						resultsFrag.appendChild(liEl.cloneNode(true));
					}

					resultsEl.html(resultsFrag);
				});
			}, 250);
		});

		Categories.refreshPrivilegeList(cid);

		resultsEl.off().on('click', '[data-priv]', function(e) {
			var	btnEl = $(this),
				uid = btnEl.parents('li[data-uid]').attr('data-uid'),
				privilege = this.getAttribute('data-priv');
			e.preventDefault();

			socket.emit('admin.categories.setPrivilege', {
				cid: cid,
				uid: uid,
				privilege: privilege,
				set: !btnEl.hasClass('active')
			}, function(err, privileges) {
				btnEl.toggleClass('active', privileges[privilege]);

				Categories.refreshPrivilegeList(cid);
			});
		});

		modal.off().on('click', '.members li > img', function() {
			searchEl.val(this.getAttribute('title'));
			searchEl.keyup();
		});

		// User Groups and privileges
		socket.emit('admin.categories.groupsList', cid, function(err, results) {
			var groupsFrag = document.createDocumentFragment(),
				numResults = results.length,
				trEl = document.createElement('tr'),
			    resultObj;

			for(var x=0;x<numResults;x++) {
				resultObj = results[x];
				trEl.setAttribute('data-gid', resultObj.gid);
				trEl.innerHTML =	'<td><h4>' + resultObj.name + '</h4></td>' +
									'<td>' +
										'<div class="btn-group pull-right">' +
											'<button type="button" data-gpriv="g+r" class="btn btn-default' + (resultObj.privileges['g+r'] ? ' active' : '') + '">Read</button>' +
											'<button type="button" data-gpriv="g+w" class="btn btn-default' + (resultObj.privileges['g+w'] ? ' active' : '') + '">Write</button>' +
										'</div>' +
									'</td>';

				groupsFrag.appendChild(trEl.cloneNode(true));
			}

			groupsResultsEl.html(groupsFrag);
		});

		groupsResultsEl.off().on('click', '[data-gpriv]', function(e) {
			var	btnEl = $(this),
				gid = btnEl.parents('tr[data-gid]').attr('data-gid'),
				privilege = this.getAttribute('data-gpriv');
			e.preventDefault();
			socket.emit('admin.categories.setGroupPrivilege', {
				cid: cid,
				gid: gid,
				privilege: privilege,
				set: !btnEl.hasClass('active')
			}, function(err) {
				if (!err) {
					btnEl.toggleClass('active');
				}
			});
		})

		modal.modal();
	};

	Categories.refreshPrivilegeList = function (cid) {
		var	modalEl = $('#category-permissions-modal'),
			readMembers = modalEl.find('#category-permissions-read'),
			writeMembers = modalEl.find('#category-permissions-write');
		socket.emit('admin.categories.getPrivilegeSettings', cid, function(err, privilegeList) {
			var	readLength = privilegeList['+r'].length,
				writeLength = privilegeList['+w'].length,
				readFrag = document.createDocumentFragment(),
				writeFrag = document.createDocumentFragment(),
				liEl = document.createElement('li'),
				x, userObj;

			if (readLength > 0) {
				for(x=0;x<readLength;x++) {
					userObj = privilegeList['+r'][x];
					liEl.setAttribute('data-uid', userObj.uid);

					liEl.innerHTML = '<img src="' + userObj.picture + '" title="' + userObj.username + '" />';
					readFrag.appendChild(liEl.cloneNode(true));
				}
			} else {
				liEl.className = 'empty';
				liEl.innerHTML = 'No users are in this list';
				readFrag.appendChild(liEl.cloneNode(true));
			}

			if (writeLength > 0) {
				for(x=0;x<writeLength;x++) {
					userObj = privilegeList['+w'][x];
					liEl.setAttribute('data-uid', userObj.uid);

					liEl.innerHTML = '<img src="' + userObj.picture + '" title="' + userObj.username + '" />';
					writeFrag.appendChild(liEl.cloneNode(true));
				}
			} else {
				liEl.className = 'empty';
				liEl.innerHTML = 'No users are in this list';
				writeFrag.appendChild(liEl.cloneNode(true));
			}

			readMembers.html(readFrag);
			writeMembers.html(writeFrag);
		});
	};

	return Categories;
});
