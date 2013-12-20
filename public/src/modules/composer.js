define(['taskbar'], function(taskbar) {
	var composer = {
		active: undefined,
		taskbar: taskbar,
		posts: {}
	};

	composer.push = function(tid, cid, pid, text) {

		socket.emit('api:composer.push', {
			tid: tid,	// Replying
			cid: cid,	// Posting
			pid: pid,	// Editing
			body: text	// Predefined text
		}, function(threadData) {

			if(threadData.error) {
				app.alert({
					type: 'danger',
					timeout: 5000,
					alert_id: 'post_error',
					title: 'Please Log In to Post',
					message: 'Posting is currently restricted to registered members only, click here to log in',
					clickfn: function() {
						ajaxify.go('login');
					}
				});
				return;
			}

			var uuid = utils.generateUUID();

			composer.taskbar.push('composer', uuid, {
				title: (!threadData.cid ? (threadData.title || '') : 'New Topic'),
				icon: threadData.picture
			});

			composer.posts[uuid] = {
				tid: threadData.tid,
				cid: threadData.cid,
				pid: threadData.pid,
				title: threadData.title || '',
				body: threadData.body || '',
				modified: false
			};

			composer.load(uuid);
		});
	}

	composer.load = function(post_uuid) {
		if($('#cmp-uuid-' + post_uuid).length) {
			composer.activateReposition(post_uuid);
		} else {
			composer.createNewComposer(post_uuid);
		}
	}

	composer.createNewComposer = function(post_uuid) {

		templates.preload_template('composer', function() {

			var composerTemplate = templates['composer'].parse({});
			composerTemplate = $(composerTemplate);

			composerTemplate.attr('id', 'cmp-uuid-' + post_uuid);

			$(document.body).append(composerTemplate);

			composer.activateReposition(post_uuid);

			var postContainer = $(composerTemplate[0]);

			if(config.imgurClientIDSet) {
				initializeFileReader(post_uuid);
			}

			var postData = composer.posts[post_uuid],
				titleEl = postContainer.find('.title'),
				bodyEl = postContainer.find('textarea');

			if (parseInt(postData.tid) > 0) {
				titleEl.val('Replying to: ' + postData.title);
				titleEl.prop('readOnly', true);
			} else if (parseInt(postData.pid) > 0) {
				titleEl.val(postData.title);
				titleEl.prop('readOnly', true);
				socket.emit('api:composer.editCheck', postData.pid, function(editCheck) {
					if (editCheck.titleEditable) {
						postContainer.find('input').prop('readonly', false);
					}
				});
			} else {
				titleEl.val(postData.title);
				titleEl.prop('readOnly', false);
			}

			bodyEl.val(postData.body);

			postContainer.on('change', 'input, textarea', function() {
				composer.posts[post_uuid].modified = true;
			});

			postContainer.on('click', '.action-bar button', function() {
				var	action = $(this).attr('data-action');

				switch(action) {
					case 'post':
						composer.post(post_uuid);
						break;
					case 'discard':
						if (composer.posts[post_uuid].modified) {
							bootbox.confirm('Are you sure you wish to discard this post?', function(discard) {
								if (discard) {
									composer.discard(post_uuid);
								}
							});
						} else {
							composer.discard(post_uuid);
						}
						break;
				}
			});

			postContainer.on('click', '.formatting-bar span', function() {
				var postContentEl = postContainer.find('textarea'),
					iconClass = $(this).find('i').attr('class'),
					cursorEnd = postContentEl.val().length,
					selectionStart = postContentEl[0].selectionStart,
					selectionEnd = postContentEl[0].selectionEnd,
					selectionLength = selectionEnd - selectionStart;


				function insertIntoInput(element, value) {
					var start = postContentEl[0].selectionStart;
					element.val(element.val().slice(0, start) + value + element.val().slice(start, element.val().length));
					postContentEl[0].selectionStart = postContentEl[0].selectionEnd = start + value.length;
				}

				switch(iconClass) {
					case 'fa fa-bold':
						if (selectionStart === selectionEnd) {
							// Nothing selected
							insertIntoInput(postContentEl, "**bolded text**");
						} else {
							// Text selected
							postContentEl.val(postContentEl.val().slice(0, selectionStart) + '**' + postContentEl.val().slice(selectionStart, selectionEnd) + '**' + postContentEl.val().slice(selectionEnd));
							postContentEl[0].selectionStart = selectionStart + 2;
							postContentEl[0].selectionEnd = selectionEnd + 2;
						}
					break;
					case 'fa fa-italic':
						if (selectionStart === selectionEnd) {
							// Nothing selected
							insertIntoInput(postContentEl, "*italicised text*");
						} else {
							// Text selected
							postContentEl.val(postContentEl.val().slice(0, selectionStart) + '*' + postContentEl.val().slice(selectionStart, selectionEnd) + '*' + postContentEl.val().slice(selectionEnd));
							postContentEl[0].selectionStart = selectionStart + 1;
							postContentEl[0].selectionEnd = selectionEnd + 1;
						}
					break;
					case 'fa fa-list':
						// Nothing selected
						insertIntoInput(postContentEl, "\n\n* list item");
					break;
					case 'fa fa-link':
						if (selectionStart === selectionEnd) {
							// Nothing selected
							insertIntoInput(postContentEl, "[link text](link url)");
						} else {
							// Text selected
							postContentEl.val(postContentEl.val().slice(0, selectionStart) + '[' + postContentEl.val().slice(selectionStart, selectionEnd) + '](link url)' + postContentEl.val().slice(selectionEnd));
							postContentEl[0].selectionStart = selectionStart + selectionLength + 3;
							postContentEl[0].selectionEnd = selectionEnd + 11;
						}
					break;
				}
			});

			var	resizeActive = false,
				resizeCenterX = 0,
				resizeOffset = 0,
				resizeAction = function(e) {
					if (resizeActive) {
						position = (e.clientX + resizeOffset);
						if (Math.abs(position - resizeSnaps.half) <= 15) {
							// Half snap
							postContainer.css('width', resizeSnaps.half);
							resizeSavePosition(resizeSnaps.half);
						} else if (Math.abs(position - resizeSnaps.none) <= 30) {
							// Minimize snap
							postContainer.css('width', bodyRect.width - resizeSnaps.none + 15);
							resizeSavePosition(resizeSnaps.none);
						} else if (position <= 30) {
							// Full snap
							postContainer.css('width', bodyRect.width - 15);
							resizeSavePosition(bodyRect.width - 15);
						} else {
							// OH SNAP, NO SNAPS!
							postContainer.css('width', bodyRect.width - position);
							resizeSavePosition(bodyRect.width - position);
						}
					}
				},
				resizeSavePosition = function(px) {
					var	percentage = px/bodyRect.width;
					localStorage.setItem('composer:resizePercentage', percentage);
				},
				resizeSnaps = {
					none: 0,
					half: 0,
					full: 0
				},
				resizeRect, bodyRect;

			var resizeEl = postContainer.find('.resizer');

			resizeEl
				.on('mousedown', function(e) {
					bodyRect = document.body.getBoundingClientRect();
					resizeRect = resizeEl[0].getBoundingClientRect();
					resizeCenterX = resizeRect.left + (resizeRect.width/2);
					resizeOffset = resizeCenterX - e.clientX;
					resizeSnaps.half = bodyRect.width / 2;
					resizeSnaps.none = bodyRect.width;
					resizeActive = true;

					$(document.body).on('mousemove', resizeAction);
				})
				.on('mouseup', function() {
					resizeActive = false;
					$(document.body).off('mousemove', resizeAction);
				});

			window.addEventListener('resize', function() {
				if (composer.active !== undefined) {
					composer.activateReposition(composer.active);
				}
			});
		});
	}

	composer.activateReposition = function(post_uuid) {

		if(composer.active && composer.active !== post_uuid) {
			composer.minimize(composer.active);
		}

		var	percentage = localStorage.getItem('composer:resizePercentage'),
			bodyRect = document.body.getBoundingClientRect(),
			postContainer = $('#cmp-uuid-' + post_uuid);

		composer.active = post_uuid;

		if (percentage) {
			if (bodyRect.width >= 768) {
				postContainer.css('width', Math.floor(bodyRect.width * percentage) + 'px');
			} else {
				postContainer.css('width', '100%');
			}
		}

		postContainer.css('visibility', 'visible');

		composer.focusElements(post_uuid);
	}

	composer.focusElements = function(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid),
			postData = composer.posts[post_uuid],
			titleEl = postContainer.find('.title'),
			bodyEl = postContainer.find('textarea');

		if ((parseInt(postData.tid) || parseInt(postData.pid)) > 0) {
			bodyEl.focus();
			bodyEl.selectionStart = bodyEl.val().length;
			bodyEl.selectionEnd = bodyEl.val().length;
		} else if (parseInt(postData.cid) > 0) {
			titleEl.focus();
		}
	}

	composer.post = function(post_uuid) {
		var postData = composer.posts[post_uuid],
			postContainer = $('#cmp-uuid-' + post_uuid),
			titleEl = postContainer.find('.title'),
			bodyEl = postContainer.find('textarea');

		titleEl.val(titleEl.val().trim());
		bodyEl.val(bodyEl.val().trim());

		if(postData.uploadsInProgress && postData.uploadsInProgress.length) {
			return app.alert({
				type: 'warning',
				timeout: 2000,
				title: 'Still uploading',
				message: "Please wait for uploads to complete.",
				alert_id: 'post_error'
			});
		}

		if (titleEl.val().length < config.minimumTitleLength) {
			return app.alert({
				type: 'danger',
				timeout: 2000,
				title: 'Title too short',
				message: "Please enter a longer title. At least " + config.minimumTitleLength+ " characters.",
				alert_id: 'post_error'
			});
		}

		if (bodyEl.val().length < config.minimumPostLength) {
			return app.alert({
				type: 'danger',
				timeout: 2000,
				title: 'Content too short',
				message: "Please enter a longer post. At least " + config.minimumPostLength + " characters.",
				alert_id: 'post_error'
			});
		}

		// Still here? Let's post.
		if (parseInt(postData.cid) > 0) {
			socket.emit('api:topics.post', {
				'title' : titleEl.val(),
				'content' : bodyEl.val(),
				'category_id' : postData.cid
			});
		} else if (parseInt(postData.tid) > 0) {
			socket.emit('api:posts.reply', {
				'topic_id' : postData.tid,
				'content' : bodyEl.val()
			});
		} else if (parseInt(postData.pid) > 0) {
			socket.emit('api:posts.edit', {
				pid: postData.pid,
				content: bodyEl.val(),
				title: titleEl.val()
			});
		}

		composer.discard(post_uuid);
	}

	composer.discard = function(post_uuid) {
		if (composer.posts[post_uuid]) {
			$('#cmp-uuid-' + post_uuid).remove();
			delete composer.posts[post_uuid];
			composer.active = undefined;
			taskbar.discard('composer', post_uuid);
		}
	}

	composer.minimize = function(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid);
		postContainer.css('visibility', 'hidden');
		composer.active = undefined;
		taskbar.minimize('composer', post_uuid);
	}

	function initializeFileReader(post_uuid) {
		if(jQuery.event.props.indexOf('dataTransfer') === -1) {
			jQuery.event.props.push('dataTransfer');
		}

		var draggingDocument = false;

		if(window.FileReader) {
			var postContainer = $('#cmp-uuid-' + post_uuid),
				drop = postContainer.find('.imagedrop'),
				textarea = postContainer.find('textarea');

			$(document).off('dragstart').on('dragstart', function(e) {
				draggingDocument = true;
			}).off('dragend').on('dragend', function(e) {
				draggingDocument = false;
			});

			textarea.on('dragenter', function(e) {
				if(draggingDocument) {
					return;
				}
				drop.css('top', textarea.position().top + 'px');
				drop.css('height', textarea.height());
				drop.css('line-height', textarea.height() + 'px');
				drop.show();

				drop.on('dragleave', function(ev) {
					drop.hide();
					drop.off('dragleave');
				});
			});

			function cancel(e) {
				e.preventDefault();
				return false;
			}

			drop.on('dragover', cancel);
			drop.on('dragenter', cancel);

			drop.on('drop', function(e) {
				e.preventDefault();
				var dt = e.dataTransfer,
					files = dt.files;

				for (var i=0; i<files.length; i++) {
					loadFile(post_uuid, files[i]);
				}

				if(!files.length) {
					drop.hide();
				}
				return false;
			});
		}
	}

	function loadFile(post_uuid, file) {
		var reader = new FileReader(),
			dropDiv = $('#cmp-uuid-' + post_uuid).find('.imagedrop');

		$(reader).on('loadend', function(e) {
			var bin = this.result;
			bin = bin.split(',')[1];

			var img = {
				name: file.name,
				data: bin
			};

			createImagePlaceholder(post_uuid, img);

			dropDiv.hide();
		});

		reader.readAsDataURL(file);
	}


	function createImagePlaceholder(post_uuid, img) {
		var postContainer = $('#cmp-uuid-' + post_uuid),
			textarea = postContainer.find('textarea'),
			text = textarea.val(),
			imgText = "![" + img.name + "](uploading...)";

		text += imgText;
		textarea.val(text + " ");

		if(!composer.posts[post_uuid].uploadsInProgress) {
			composer.posts[post_uuid].uploadsInProgress = [];
		}

		composer.posts[post_uuid].uploadsInProgress.push(1);

		socket.emit("api:posts.uploadImage", img, function(err, data) {
			if(err) {
				return app.alertError(err.message);
			}
			var currentText = textarea.val();
			imgText = "![" + data.name + "](uploading...)";

			if(!err) {
				textarea.val(currentText.replace(imgText, "![" + data.name + "](" + data.url + ")"));
			} else {
				textarea.val(currentText.replace(imgText, "![" + data.name + "](upload error)"));
			}
			composer.posts[post_uuid].uploadsInProgress.pop();
		});
	}

	return {
		push: composer.push,
		load: composer.load,
		minimize: composer.minimize
	};
});