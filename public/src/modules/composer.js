define(['taskbar'], function(taskbar) {
	var composer = {
		initialized: false,
		active: undefined,
		taskbar: taskbar,
		posts: {},
		postContainer: undefined,
	};

	function createImagePlaceholder(img) {
		var text = $('.post-window textarea').val(),
			textarea = $('.post-window textarea'),
			imgText = "!["+img.name+"](uploading...)",
			uuid = $('.post-window .imagedrop').parents('[data-uuid]').attr('data-uuid');

		text += imgText;
		textarea.val(text + " ");
		if(!composer.posts[uuid].uploadsInProgress) {
			composer.posts[uuid].uploadsInProgress = [];
		}

		composer.posts[uuid].uploadsInProgress.push(1);

		socket.emit("api:posts.uploadImage", img, function(err, data) {
			if(err) {
				return app.alertError(err.message);
			}
			var currentText = textarea.val();
			imgText = "!["+data.name+"](uploading...)";

			if(!err)
				textarea.val(currentText.replace(imgText, "!["+data.name+"]("+data.url+")"));
			else
				textarea.val(currentText.replace(imgText, "!["+data.name+"](upload error)"));
			composer.posts[uuid].uploadsInProgress.pop();
		});
	}

	function loadFile(file) {
		var reader = new FileReader(),
			dropDiv = $('.post-window .imagedrop');

		$(reader).on('loadend', function(e) {
			var bin = this.result;
			bin = bin.split(',')[1];

			var img = {
				name: file.name,
				data: bin
			};

			createImagePlaceholder(img);

			dropDiv.hide();
		});

		reader.readAsDataURL(file);
	}

	function initializeFileReader() {
		jQuery.event.props.push( "dataTransfer" );

		var draggingDocument = false;

		if(window.FileReader) {
			var drop = $('.post-window .imagedrop'),
				textarea = $('.post-window textarea');

			$(document).on('dragstart', function(e) {
				draggingDocument = true;
			}).on('dragend', function(e) {
				draggingDocument = false;
			});

			textarea.on('dragenter', function(e) {
				if(draggingDocument) {
					return;
				}
				drop.css('top', textarea.position().top + 'px');
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
				var uuid = drop.parents('[data-uuid]').attr('data-uuid'),
					dt = e.dataTransfer,
					files = dt.files;

				for (var i=0; i<files.length; i++) {
					loadFile(files[i]);
				}

				if(!files.length)
					drop.hide();
				return false;
			});
		}
	}

	composer.init = function() {
		if (!composer.initialized) {
			templates.preload_template('composer', function() {
				$(document.body).append(templates['composer'].parse({}));
				composer.postContainer = $('.composer')[0];

				if(config.imgurClientIDSet) {
					initializeFileReader();
				}

				socket.on('api:composer.push', function(threadData) {
					if (!threadData.error) {
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
					} else {
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
					}
				});

				socket.on('api:composer.editCheck', function(editCheck) {
					if (editCheck.titleEditable === true) composer.postContainer.querySelector('input').readOnly = false;
				});

				// Post Window events
				var	jPostContainer = $(composer.postContainer),
					postContentEl = composer.postContainer.querySelector('textarea'),
					resizeEl = jPostContainer.find('.resizer');

				jPostContainer.on('change', 'input, textarea', function() {
					var uuid = $(this).parents('.composer').attr('data-uuid');
					if (this.nodeName === 'INPUT') composer.posts[uuid].title = this.value;
					else if (this.nodeName === 'TEXTAREA') composer.posts[uuid].body = this.value;

					// Mark this post window as having been changed
					composer.posts[uuid].modified = true;
				});

				jPostContainer.on('click', '.action-bar button', function() {
					var	action = this.getAttribute('data-action'),
						uuid = $(this).parents('.composer').attr('data-uuid');
					switch(action) {
						case 'post': composer.post(uuid); break;
						case 'discard':
							if (composer.posts[uuid].modified) {
								bootbox.confirm('Are you sure you wish to discard this post?', function(discard) {
									if (discard) composer.discard(uuid);
								});
							} else {
								composer.discard(uuid);
							}
							break;
					}
				});

				jPostContainer.on('click', '.formatting-bar span', function() {
					var iconClass = this.querySelector('i').className,
						cursorEnd = postContentEl.value.length,
						selectionStart = postContentEl.selectionStart,
						selectionEnd = postContentEl.selectionEnd,
						selectionLength = selectionEnd - selectionStart;

					function insertIntoInput(element, value) {
						var start = postContentEl.selectionStart;
						element.value = element.value.slice(0, start) + value + element.value.slice(start, element.value.length);
						postContentEl.selectionStart = postContentEl.selectionEnd = start + value.length;
					}

					switch(iconClass) {
						case 'fa fa-bold':
							if (selectionStart === selectionEnd) {
								// Nothing selected
								insertIntoInput(postContentEl, "**bolded text**");
							} else {
								// Text selected
								postContentEl.value = postContentEl.value.slice(0, selectionStart) + '**' + postContentEl.value.slice(selectionStart, selectionEnd) + '**' + postContentEl.value.slice(selectionEnd);
								postContentEl.selectionStart = selectionStart + 2;
								postContentEl.selectionEnd = selectionEnd + 2;
							}
						break;
						case 'fa fa-italic':
							if (selectionStart === selectionEnd) {
								// Nothing selected
								insertIntoInput(postContentEl, "*italicised text*");
							} else {
								// Text selected
								postContentEl.value = postContentEl.value.slice(0, selectionStart) + '*' + postContentEl.value.slice(selectionStart, selectionEnd) + '*' + postContentEl.value.slice(selectionEnd);
								postContentEl.selectionStart = selectionStart + 1;
								postContentEl.selectionEnd = selectionEnd + 1;
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
								postContentEl.value = postContentEl.value.slice(0, selectionStart) + '[' + postContentEl.value.slice(selectionStart, selectionEnd) + '](link url)' + postContentEl.value.slice(selectionEnd);
								postContentEl.selectionStart = selectionStart + selectionLength + 3;
								postContentEl.selectionEnd = selectionEnd + 11;
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
								jPostContainer.css('width', resizeSnaps.half);
								resizeSavePosition(resizeSnaps.half);
							} else if (Math.abs(position - resizeSnaps.none) <= 30) {
								// Minimize snap
								jPostContainer.css('width', bodyRect.width - resizeSnaps.none + 15);
								resizeSavePosition(resizeSnaps.none);
							} else if (position <= 30) {
								// Full snap
								jPostContainer.css('width', bodyRect.width - 15);
								resizeSavePosition(bodyRect.width - 15);
							} else {
								// OH SNAP, NO SNAPS!
								jPostContainer.css('width', bodyRect.width - position);
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
					if (composer.active !== undefined) composer.reposition(composer.active);
				});

				composer.initialized = true;
			});
		}
	}

	composer.push = function(tid, cid, pid, text) {
		if (!composer.initialized) {
			var	args = arguments;
			setTimeout(function() {
				composer.push.apply(composer, args);
			}, 500);
		} else {
			socket.emit('api:composer.push', {
				tid: tid,	// Replying
				cid: cid,	// Posting
				pid: pid,	// Editing
				body: text	// Predefined text
			});
		}
	}

	composer.load = function(post_uuid) {
		var post_data = composer.posts[post_uuid],
			titleEl = composer.postContainer.querySelector('input'),
			bodyEl = composer.postContainer.querySelector('textarea');

		composer.reposition(post_uuid);
		composer.active = post_uuid;

		composer.postContainer.setAttribute('data-uuid', post_uuid);
		if (parseInt(post_data.tid) > 0) {
			titleEl.value = 'Replying to: ' + post_data.title;
			titleEl.readOnly = true;
		} else if (parseInt(post_data.pid) > 0) {
			titleEl.value = post_data.title;
			titleEl.readOnly = true;
			socket.emit('api:composer.editCheck', post_data.pid);
		} else {
			titleEl.value = post_data.title;
			titleEl.readOnly = false;
		}
		bodyEl.value = post_data.body;


		// Direct user focus to the correct element
		if ((parseInt(post_data.tid) || parseInt(post_data.pid)) > 0) {
			bodyEl.focus();
			bodyEl.selectionStart = bodyEl.value.length;
			bodyEl.selectionEnd = bodyEl.value.length;
		} else if (parseInt(post_data.cid) > 0) {
			titleEl.focus();
		}
	}

	composer.reposition = function(post_uuid) {
		// Resize the composer to the saved size
		var	percentage = localStorage.getItem('composer:resizePercentage'),
			bodyRect = document.body.getBoundingClientRect();

		if (percentage) {
			if (bodyRect.width >= 768) {
				composer.postContainer.style.width = Math.floor(bodyRect.width * percentage) + 'px';
			} else {
				composer.postContainer.style.width = '100%';
			}
		}

		composer.postContainer.style.visibility = 'visible';
	}

	composer.post = function(post_uuid) {
		// Check title and post length
		var postData = composer.posts[post_uuid],
			titleEl = composer.postContainer.querySelector('input'),
			bodyEl = composer.postContainer.querySelector('textarea');

		titleEl.value = titleEl.value.trim();
		bodyEl.value = bodyEl.value.trim();

		if(postData.uploadsInProgress && postData.uploadsInProgress.length) {
			return app.alert({
				type: 'warning',
				timeout: 2000,
				title: 'Still uploading',
				message: "Please wait for uploads to complete.",
				alert_id: 'post_error'
			});
		}

		if (titleEl.value.length < config.minimumTitleLength) {
			return app.alert({
				type: 'danger',
				timeout: 2000,
				title: 'Title too short',
				message: "Please enter a longer title. At least " + config.minimumTitleLength+ " characters.",
				alert_id: 'post_error'
			});
		}

		if (bodyEl.value.length < config.minimumPostLength) {
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
				'title' : titleEl.value,
				'content' : bodyEl.value,
				'category_id' : postData.cid
			});
		} else if (parseInt(postData.tid) > 0) {
			socket.emit('api:posts.reply', {
				'topic_id' : postData.tid,
				'content' : bodyEl.value
			});
		} else if (parseInt(postData.pid) > 0) {
			socket.emit('api:posts.edit', {
				pid: postData.pid,
				content: bodyEl.value,
				title: titleEl.value
			});
		}

		composer.discard(post_uuid);
	}

	composer.discard = function(post_uuid) {
		if (composer.posts[post_uuid]) {
			$(composer.postContainer).find('.imagedrop').hide();
			delete composer.posts[post_uuid];
			composer.minimize();
			taskbar.discard('composer', post_uuid);
		}
	}

	composer.minimize = function(uuid) {
		composer.postContainer.style.visibility = 'hidden';
		composer.active = undefined;
		taskbar.minimize('composer', uuid);
	}

	composer.init();

	return {
		push: composer.push,
		load: composer.load,
		minimize: composer.minimize
	};
});