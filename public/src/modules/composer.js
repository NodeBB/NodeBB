'use strict';

/* globals define, socket, app, config, ajaxify, utils, translator, templates, bootbox */

define(['taskbar'], function(taskbar) {
	var composer = {
		active: undefined,
		posts: {},
		saving: undefined
	};

	function initialise() {
		socket.on('event:composer.ping', function(post_uuid) {
			if (composer.active === post_uuid) {
				socket.emit('modules.composer.pingActive', post_uuid);
			}
		});
	}

	initialise();

	function maybeParse(response) {
		if (typeof response === 'string')  {
			try {
				return $.parseJSON(response);
			} catch (e) {
				return {status: 500, message: 'Something went wrong while parsing server response'};
			}
		}
		return response;
	}

	function resetInputFile($el) {
		$el.wrap('<form />').closest('form').get(0).reset();
		$el.unwrap();
	}

	function allowed() {
		if(!(parseInt(app.uid, 10) > 0 || config.allowGuestPosting)) {
			app.alert({
				type: 'danger',
				timeout: 5000,
				alert_id: 'post_error',
				title: '[[global:please_log_in]]',
				message: '[[global:posting_restriction_info]]',
				clickfn: function() {
					ajaxify.go('login');
				}
			});
			return false;
		}
		return true;
	}

	function alreadyOpen(post) {
		// If a composer for the same cid/tid/pid is already open, return the uuid, else return bool false
		var	type, id;

		if (post.hasOwnProperty('cid')) {
			type = 'cid';
		} else if (post.hasOwnProperty('tid')) {
			type = 'tid';
		} else if (post.hasOwnProperty('pid')) {
			type = 'pid';
		}

		id = post[type];

		// Find a match
		for(var uuid in composer.posts) {
			if (composer.posts[uuid].hasOwnProperty(type) && id === composer.posts[uuid][type]) {
				return uuid;
			}
		}

		// No matches...
		return false;
	}

	function canSave() {
		// Check for localStorage support
		if (composer.saving) {
			return composer.saving;
		}

		try {
			localStorage.setItem('test', 'test');
			localStorage.removeItem('test');
			composer.saving = true;
			return true;
		} catch(e) {
			composer.saving = false;
			return false;
		}
	}

	function getDraft(save_id) {
		return localStorage.getItem(save_id);
	}

	function saveDraft(post_uuid) {
		var postData = composer.posts[post_uuid],
			postContainer = $('#cmp-uuid-' + post_uuid),
			raw;

		if (canSave() && postData && postData.save_id && postContainer.length) {
			raw = postContainer.find('textarea').val();
			if (raw.length) {
				localStorage.setItem(postData.save_id, raw);
			} else {
				removeDraft(postData.save_id);
			}
		}
	}

	function removeDraft(save_id) {
		return localStorage.removeItem(save_id);
	}

	function push(post) {
		var uuid = utils.generateUUID(),
			existingUUID = alreadyOpen(post);

		if (existingUUID) {
			taskbar.updateActive(existingUUID);
			return composer.load(existingUUID);
		}

		translator.translate('[[topic:composer.new_topic]]', function(newTopicStr) {
			taskbar.push('composer', uuid, {
				title: post.title ? post.title : newTopicStr,
				icon: post.picture
			});
		});

		// Construct a save_id
		if (0 !== parseInt(app.uid, 10)) {
			if (post.hasOwnProperty('cid')) {
				post.save_id = ['composer', app.uid, 'cid', post.cid].join(':');
			} else if (post.hasOwnProperty('tid')) {
				post.save_id = ['composer', app.uid, 'tid', post.tid].join(':');
			} else if (post.hasOwnProperty('pid')) {
				post.save_id = ['composer', app.uid, 'pid', post.pid].join(':');
			}
		}

		composer.posts[uuid] = post;
		composer.posts[uuid].uploadsInProgress = [];

		composer.load(uuid);
	}

	//http://stackoverflow.com/questions/14441456/how-to-detect-which-device-view-youre-on-using-twitter-bootstrap-api
	function findBootstrapEnvironment() {
		var envs = ['xs', 'sm', 'md', 'lg'],
			$el = $('<div>');

		$el.appendTo($('body'));

		for (var i = envs.length - 1; i >= 0; i--) {
			var env = envs[i];

			$el.addClass('hidden-'+env);
			if ($el.is(':hidden')) {
				$el.remove();
				return env;
			}
		}
	}

	function composerAlert(message) {
		$('.action-bar button').removeAttr('disabled');
		app.alert({
			type: 'danger',
			timeout: 3000,
			title: '',
			message: message,
			alert_id: 'post_error'
		});
	}

	function initializeDragAndDrop(post_uuid) {

		if($.event.props.indexOf('dataTransfer') === -1) {
			$.event.props.push('dataTransfer');
		}

		var draggingDocument = false;

		var postContainer = $('#cmp-uuid-' + post_uuid),
			drop = postContainer.find('.imagedrop'),
			tabContent = postContainer.find('.tab-content'),
			textarea = postContainer.find('textarea');

		$(document).off('dragstart').on('dragstart', function() {
			draggingDocument = true;
		}).off('dragend').on('dragend', function() {
			draggingDocument = false;
		});

		textarea.on('dragenter', function() {
			if(draggingDocument) {
				return;
			}
			drop.css('top', tabContent.position().top + 'px');
			drop.css('height', textarea.height());
			drop.css('line-height', textarea.height() + 'px');
			drop.show();

			drop.on('dragleave', function() {
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
			var files = e.files || (e.dataTransfer || {}).files || (e.target.value ? [e.target.value] : []),
				fd;

			if(files.length) {
				if (window.FormData) {
					fd = new FormData();
					for (var i = 0; i < files.length; ++i) {
						fd.append('files[]', files[i], files[i].name);
					}
				}

				uploadContentFiles({
					files: files,
					post_uuid: post_uuid,
					route: '/api/post/upload',
					formData: fd
				});
			}

			drop.hide();
			return false;
		});

		$(window).off('paste').on('paste', function(event) {

			var items = (event.clipboardData || event.originalEvent.clipboardData || {}).items,
				fd;

			if(items && items.length) {

				var blob = items[0].getAsFile();
				if(blob) {
					blob.name = 'upload-'+ utils.generateUUID();

					if (window.FormData) {
						fd = new FormData();
						fd.append('files[]', blob, blob.name);
					}

					uploadContentFiles({
						files: [blob],
						post_uuid: post_uuid,
						route: '/api/post/upload',
						formData: fd
					});
				}
			}
		});
	}

	function escapeRegExp(text) {
		return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
	}

	function uploadContentFiles(params) {
		var files = params.files,
			post_uuid = params.post_uuid,
			route = params.route,
			formData = params.formData,
			callback = params.callback,
			postContainer = $('#cmp-uuid-' + post_uuid),
			textarea = postContainer.find('textarea'),
			text = textarea.val(),
			uploadForm = postContainer.find('#fileForm');

		uploadForm.attr('action', route);

		for(var i = 0; i < files.length; ++i) {
			var isImage = files[i].type.match(/image./);
			text += (isImage ? '!' : '') + '[' + files[i].name + '](uploading...) ';

			if(files[i].size > parseInt(config.maximumFileSize, 10) * 1024) {
				uploadForm[0].reset();
				return composerAlert('[[error:file-too-big, ' + config.maximumFileSize + ']]');
			}
		}

		textarea.val(text);

		uploadForm.off('submit').submit(function() {
			function updateTextArea(filename, text) {
				var current = textarea.val();
				var re = new RegExp(escapeRegExp(filename) + "]\\([^)]+\\)", 'g');
				textarea.val(current.replace(re, filename + '](' + text + ')'));
			}

			$(this).find('#postUploadCsrf').val($('#csrf_token').val());

			if (formData) {
				formData.append('_csrf', $('#csrf_token').val());
			}

			composer.posts[post_uuid].uploadsInProgress.push(1);

			$(this).ajaxSubmit({
				resetForm: true,
				clearForm: true,
				formData: formData,

				error: function(xhr) {
					xhr = maybeParse(xhr);

					app.alertError('Error uploading file!\nStatus : ' + xhr.status + '\nMessage : ' + xhr.responseText);
					if (typeof callback === 'function') {
						callback(xhr);
					}
				},

				uploadProgress: function(event, position, total, percent) {
					for(var i=0; i < files.length; ++i) {
						updateTextArea(files[i].name, 'uploading ' + percent + '%');
					}
				},

				success: function(uploads) {
					uploads = maybeParse(uploads);

					if(uploads && uploads.length) {
						for(var i=0; i<uploads.length; ++i) {
							updateTextArea(uploads[i].name, uploads[i].url);
						}
					}

					textarea.focus();
					if (typeof callback === 'function') {
						callback(null, uploads);
					}
				},

				complete: function() {
					uploadForm[0].reset();
					composer.posts[post_uuid].uploadsInProgress.pop();
				}
			});

			return false;
		});

		uploadForm.submit();
	}

	function uploadTopicThumb(params) {
		var post_uuid = params.post_uuid,
			route = params.route,
			formData = params.formData,
			callback = params.callback,
			postContainer = $('#cmp-uuid-' + post_uuid),
			spinner = postContainer.find('.topic-thumb-spinner'),
			thumbForm = postContainer.find('#thumbForm');

		thumbForm.attr('action', route);

		thumbForm.off('submit').submit(function() {
			var csrf = $('#csrf_token').val();
			$(this).find('#thumbUploadCsrf').val(csrf);

			if(formData) {
				formData.append('_csrf', csrf);
			}

			spinner.removeClass('hide');
			composer.posts[post_uuid].uploadsInProgress.push(1);

			$(this).ajaxSubmit({
				formData: formData,
				error: function(xhr) {
					xhr = maybeParse(xhr);

					app.alertError('Error uploading file!\nStatus : ' + xhr.status + '\nMessage : ' + xhr.responseText);
					if (typeof callback === 'function') {
						callback(xhr);
					}
				},
				success: function(uploads) {
					uploads = maybeParse(uploads);

					postContainer.find('#topic-thumb-url').val((uploads[0] || {}).url || '').trigger('change');
					if (typeof callback === 'function') {
						callback(null, uploads);
					}
				},
				complete: function() {
					composer.posts[post_uuid].uploadsInProgress.pop();
					spinner.addClass('hide');
				}
			});
			return false;
		});
		thumbForm.submit();
	}

	function handleFormattingBarClick() {
		var iconClass = $(this).find('i').attr('class');
		var textarea = $(this).parents('.composer').find('textarea')[0];

		var textareaValue = $(textarea).val();

		var selectionStart = textarea.selectionStart,
			selectionEnd = textarea.selectionEnd,
			selectionLength = selectionEnd - selectionStart,
			isSelectionAtEnd = selectionStart === selectionEnd;

		function updateSelection(start, end){
			textarea.setSelectionRange(start, end);
			textarea.focus();
		}

		function insertIntoInput(value) {
			$(textarea).val(textareaValue.slice(0, selectionStart) + value + textareaValue.slice(selectionStart));
		}

		function wrapSelectedWith(leading, trailing){
			if(trailing === undefined){
				trailing = leading;
			}

			$(textarea).val(textareaValue.slice(0, selectionStart) + leading + textareaValue.slice(selectionStart, selectionEnd) + trailing + textareaValue.slice(selectionEnd));
		}

		if(iconClass === 'fa fa-bold') {
			if (isSelectionAtEnd) {
				insertIntoInput("**bolded text**");

				updateSelection(selectionStart + 2, selectionStart + 13);
			} else {
				wrapSelectedWith('**');

				// Highlight selection
				updateSelection(selectionStart + 2, selectionEnd + 2);
			}
		}

		if(iconClass === 'fa fa-italic') {
			if (isSelectionAtEnd) {
				insertIntoInput("*italicised text*");

				// Highlight selection
				updateSelection(selectionStart + 1, selectionStart + 16);
			} else {
				wrapSelectedWith('*');

				// Highlight selection
				updateSelection(selectionStart + 1, selectionEnd + 1);
			}
		}

		if (iconClass === 'fa fa-list'){
			if(isSelectionAtEnd){
				insertIntoInput("\n* list item");

				// Highlight "list item"
				updateSelection(selectionStart + 3, selectionStart + 12);
			} else {
				wrapSelectedWith('\n* ', '');

				// Maintain selection:
				updateSelection(selectionStart + 3, selectionEnd + 3);
			}
		}

		if (iconClass === 'fa fa-link') {
			if (isSelectionAtEnd) {
				insertIntoInput("[link text](link url)");

				// Highlight "link url"
				updateSelection(selectionStart + 12, selectionEnd + 20);
			} else {
				wrapSelectedWith('[', '](link url)');

				// Highlight "link url"
				updateSelection(selectionStart + selectionLength + 3, selectionEnd + 11);
			}
		}
	}

	composer.newTopic = function(cid) {
		if(!allowed()) {
			return;
		}

		push({
			cid: cid,
			title: '',
			body: '',
			modified: false,
			isMain: true
		});
	};

	composer.addQuote = function(tid, pid, title, username, text){
		if (!allowed()) {
			return;
		}

		var uuid = composer.active;

		if(uuid === undefined){
			composer.newReply(tid, pid, title, username + ' said:\n' + text);
			return;
		}

		var bodyEl = $('#cmp-uuid-'+uuid).find('textarea');
		var prevText = bodyEl.val();
		if(tid !== composer.posts[uuid].tid) {
			text = username + ' said in ['+title+'](/topic/'+tid+'#'+pid+'):\n'+text;
		} else {
			text = username + ' said:\n' + text;
		}
		composer.posts[uuid].body = (prevText.length ? prevText + '\n\n' : '') + text;
		bodyEl.val(composer.posts[uuid].body);
	};

	composer.newReply = function(tid, pid, title, text) {
		if(!allowed()) {
			return;
		}

		push({
			tid: tid,
			toPid: pid,
			title: title,
			body: text,
			modified: false,
			isMain: false
		});
	};

	composer.editPost = function(pid) {
		if(!allowed()) {
			return;
		}

		socket.emit('modules.composer.push', pid, function(err, threadData) {
			if(err) {
				return app.alertError(err.message);
			}

			push({
				pid: pid,
				title: threadData.title,
				body: threadData.body,
				modified: false,
				isMain: !threadData.index,
				topic_thumb: threadData.topic_thumb
			});
		});
	};

	composer.load = function(post_uuid) {
		if($('#cmp-uuid-' + post_uuid).length) {
			composer.activateReposition(post_uuid);
		} else {
			composer.createNewComposer(post_uuid);
		}

		var	postData = composer.posts[post_uuid];
		if (postData.tid) {
			// Replying to a topic
			socket.emit('modules.composer.register', {
				uuid: post_uuid,
				tid: postData.tid,
				uid: app.uid
			});
		}
	};

	composer.createNewComposer = function(post_uuid) {
		var allowTopicsThumbnail = config.allowTopicsThumbnail && composer.posts[post_uuid].isMain && (config.hasImageUploadPlugin || config.allowFileUploads);

		templates.parse('composer', {allowTopicsThumbnail: allowTopicsThumbnail}, function(composerTemplate) {
			translator.translate(composerTemplate, function(composerTemplate) {
				composerTemplate = $(composerTemplate);

				composerTemplate.attr('id', 'cmp-uuid-' + post_uuid);

				$(document.body).append(composerTemplate);

				composer.activateReposition(post_uuid);

				var postContainer = $(composerTemplate[0]);

				if(config.allowFileUploads || config.hasImageUploadPlugin) {
					initializeDragAndDrop(post_uuid);
				}

				var postData = composer.posts[post_uuid],
					titleEl = postContainer.find('.title'),
					bodyEl = postContainer.find('textarea'),
					thumbToggleBtnEl = postContainer.find('.topic-thumb-toggle-btn'),
					draft = getDraft(postData.save_id),

					toggleThumbEls = function(){
						if (config.allowTopicsThumbnail && composer.posts[post_uuid].isMain) {
							var url = composer.posts[post_uuid].topic_thumb || '';
							postContainer.find('input#topic-thumb-url').val(url);
							postContainer.find('img.topic-thumb-preview').attr('src', url);
							if (url) {
								postContainer.find('.topic-thumb-clear-btn').removeClass('hide');
							}
							thumbToggleBtnEl.removeClass('hide');
						}
					};

				if (parseInt(postData.tid, 10) > 0) {
					translator.translate('[[topic:composer.replying_to, ' + postData.title + ']]', function(newTitle) {
						titleEl.val(newTitle);
					});
					titleEl.prop('disabled', true);
				} else if (parseInt(postData.pid, 10) > 0) {
					titleEl.val(postData.title);
					titleEl.prop('disabled', true);
					socket.emit('modules.composer.editCheck', postData.pid, function(err, editCheck) {
						if (!err && editCheck.titleEditable) {
							titleEl.prop('disabled', false);
						}
					});
					toggleThumbEls();
				} else {
					titleEl.val(postData.title);
					titleEl.prop('disabled', false);
					toggleThumbEls();
				}

				if (draft) {
					bodyEl.val(draft);
				} else {
					bodyEl.val(postData.body);
				}

				thumbToggleBtnEl.on('click', function() {
					var container = postContainer.find('.topic-thumb-container');
					if (container.hasClass('hide')) {
						container.removeClass('hide');
					} else {
						container.addClass('hide');
					}
				});

				postContainer.on('click', '.topic-thumb-clear-btn', function(e) {
					postContainer.find('input#topic-thumb-url').val('').trigger('change');
					resetInputFile(postContainer.find('input#topic-thumb-file'));
					$(this).addClass('hide');
					e.preventDefault();
				});

				postContainer.on('paste change keypress', 'input#topic-thumb-url', function() {
					var urlEl = $(this);
					setTimeout(function(){
						var url = urlEl.val();
						if (url) {
							postContainer.find('.topic-thumb-clear-btn').removeClass('hide');
						} else {
							resetInputFile(postContainer.find('input#topic-thumb-file'));
							postContainer.find('.topic-thumb-clear-btn').addClass('hide');
						}
						postContainer.find('img.topic-thumb-preview').attr('src', url);
					}, 100);
				});

				postContainer.on('change', 'input, textarea', function() {
					composer.posts[post_uuid].modified = true;
				});

				postContainer.on('click', '.action-bar button', function() {
					var	action = $(this).attr('data-action');

					switch(action) {
						case 'post':
							$(this).attr('disabled', true);
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

				postContainer.on('click', '.formatting-bar span', handleFormattingBarClick);

				postContainer.on('click', '.formatting-bar span .fa-picture-o, .formatting-bar span .fa-upload', function() {
					$('#files').click();
				});

				postContainer.find('#files').on('change', function(e) {
					var files = (e.target || {}).files || ($(this).val() ? [{name: $(this).val(), type: utils.fileMimeType($(this).val())}] : null);
					if(files) {
						uploadContentFiles({files: files, post_uuid: post_uuid, route: '/api/post/upload'});
					}
				});

				postContainer.find('#topic-thumb-file').on('change', function(e) {
					var files = (e.target || {}).files || ($(this).val() ? [{name: $(this).val(), type: utils.fileMimeType($(this).val())}] : null),
						fd;

					if(files) {
						if (window.FormData) {
							fd = new FormData();
							for (var i = 0; i < files.length; ++i) {
								fd.append('files[]', files[i], files[i].name);
							}
						}
						uploadTopicThumb({files: files, post_uuid: post_uuid, route: '/api/topic/thumb/upload', formData: fd});
					}
				});

				postContainer.find('.nav-tabs a').click(function (e) {
					e.preventDefault();
					$(this).tab('show');
					var selector = $(this).attr('data-pane');
					postContainer.find('.tab-content div').removeClass('active');
					postContainer.find(selector).addClass('active');
					if(selector === '.tab-write') {
						bodyEl.focus();
					}
					return false;
				});

				bodyEl.on('blur', function() {
					socket.emit('modules.composer.renderPreview', bodyEl.val(), function(err, preview) {
						preview = $(preview);
						preview.find('img').addClass('img-responsive');
						postContainer.find('.preview').html(preview);
					});
				});

				// Draft Saving
				var	saveThrottle;
				bodyEl.on('keyup', function() {
					if (saveThrottle) {
						clearTimeout(saveThrottle);
					}

					saveThrottle = setTimeout(function() {
						saveDraft(post_uuid);
					}, 1000);
				});

				var	resizeActive = false,
					resizeCenterY = 0,
					resizeOffset = 0,
					resizeStart = function(e) {
						resizeRect = resizeEl[0].getBoundingClientRect();
						resizeCenterY = resizeRect.top + (resizeRect.height/2);
						resizeOffset = resizeCenterY - e.clientY;
						resizeActive = true;

						$(window).on('mousemove', resizeAction);
						$(window).on('mouseup', resizeStop);
						$('body').on('touchmove', resizeTouchAction);
					},
					resizeStop = function() {
						resizeActive = false;
						bodyEl.focus();
						$(window).off('mousemove', resizeAction);
						$(window).off('mouseup', resizeStop);
						$('body').off('touchmove', resizeTouchAction);
					},
					resizeTouchAction = function(e) {
						e.preventDefault();
						resizeAction(e.touches[0]);
					},
					resizeAction = function(e) {
						if (resizeActive) {
							var position = (e.clientY + resizeOffset);
							var newHeight = $(window).height() - position;
							var paddingBottom = parseInt(postContainer.css('padding-bottom'), 10);
							if(newHeight > $(window).height() - $('#header-menu').height() - 20) {
								newHeight = $(window).height() - $('#header-menu').height() - 20;
							} else if (newHeight < paddingBottom) {
								newHeight = paddingBottom;
							}

							postContainer.css('height', newHeight);
							$('body').css({'margin-bottom': newHeight});
							resizeSavePosition(newHeight);
						}
						e.preventDefault();
						return false;
					},
					resizeSavePosition = function(px) {
						var	percentage = px / $(window).height();
						localStorage.setItem('composer:resizePercentage', percentage);
					},
					resizeRect;

				var resizeEl = postContainer.find('.resizer');

				resizeEl.on('mousedown', resizeStart);

				resizeEl.on('touchstart', function(e) {
					e.preventDefault();
					resizeStart(e.touches[0]);
				});
				resizeEl.on('touchend', function(e) {
					e.preventDefault();
					resizeStop();
				});

				$(window).on('resize', function() {
					if (composer.active !== undefined) {
						composer.activateReposition(composer.active);
					}
				});

				socket.emit('modules.composer.renderHelp', function(err, html) {
					if (html && html.length > 0) {
						postContainer.find('.help').html(html);
						postContainer.find('[data-pane=".tab-help"]').parent().removeClass('hidden');
					}
				});

				$(window).trigger('action:composer.loaded', {
					post_uuid: post_uuid
				});
			});
		});
	};

	composer.activateReposition = function(post_uuid) {

		if(composer.active && composer.active !== post_uuid) {
			composer.minimize(composer.active);
		}

		var	percentage = localStorage.getItem('composer:resizePercentage'),
			postContainer = $('#cmp-uuid-' + post_uuid);

		composer.active = post_uuid;
		var env = findBootstrapEnvironment();

		if (percentage) {
			if ( env === 'md' || env === 'lg') {
				postContainer.css('height', Math.floor($(window).height() * percentage) + 'px');
			}
		}

		if(env === 'sm' || env === 'xs') {
			postContainer.css('height', $(window).height() - $('#header-menu').height());
		}

		if(config.hasImageUploadPlugin) {
			if(env === 'md' || env === 'lg') {
				postContainer.find('.upload-instructions').removeClass('hide');
			}
			postContainer.find('.img-upload-btn').removeClass('hide');
			postContainer.find('#files.lt-ie9').removeClass('hide');
		}

		if(config.allowFileUploads) {
			postContainer.find('.file-upload-btn').removeClass('hide');
			postContainer.find('#files.lt-ie9').removeClass('hide');
		}

		postContainer.css('visibility', 'visible')
			.css('z-index', 2);

		$('body').css({'margin-bottom': postContainer.css('height')});

		composer.focusElements(post_uuid);
	};

	composer.focusElements = function(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid),
			postData = composer.posts[post_uuid],
			titleEl = postContainer.find('.title'),
			bodyEl = postContainer.find('textarea');

		if ((parseInt(postData.tid, 10) || parseInt(postData.pid, 10)) > 0) {
			bodyEl.focus();
			bodyEl.selectionStart = bodyEl.val().length;
			bodyEl.selectionEnd = bodyEl.val().length;
		} else if (parseInt(postData.cid, 10) > 0) {
			titleEl.focus();
		}
	};

	composer.post = function(post_uuid) {
		var postData = composer.posts[post_uuid],
			postContainer = $('#cmp-uuid-' + post_uuid),
			titleEl = postContainer.find('.title'),
			bodyEl = postContainer.find('textarea'),
			thumbEl = postContainer.find('input#topic-thumb-url');

		titleEl.val(titleEl.val().trim());
		bodyEl.val(bodyEl.val().trim());
		if(thumbEl.length) {
			thumbEl.val(thumbEl.val().trim());
		}

		var checkTitle = parseInt(postData.cid, 10) || parseInt(postData.pid, 10);

		if(postData.uploadsInProgress && postData.uploadsInProgress.length) {
			return composerAlert('[[error:still-uploading]]');
		} else if (checkTitle && titleEl.val().length < parseInt(config.minimumTitleLength, 10)) {
			return composerAlert('[[error:title-too-short, ' + config.minimumTitleLength + ']]');
		} else if (checkTitle && titleEl.val().length > parseInt(config.maximumTitleLength, 10)) {
			return composerAlert('[[error:title-too-long, ' + config.maximumTitleLength + ']]');
		} else if (bodyEl.val().length < parseInt(config.minimumPostLength, 10)) {
			return composerAlert('[[error:content-too-short, ' + config.minimumPostLength + ']]');
		}

		if (parseInt(postData.cid, 10) > 0) {
			socket.emit('topics.post', {
				title: titleEl.val(),
				content: bodyEl.val(),
				topic_thumb: thumbEl.val() || '',
				category_id: postData.cid
			}, done);
		} else if (parseInt(postData.tid, 10) > 0) {
			socket.emit('posts.reply', {
				tid: postData.tid,
				content: bodyEl.val(),
				toPid: postData.toPid
			}, done);
		} else if (parseInt(postData.pid, 10) > 0) {
			socket.emit('posts.edit', {
				pid: postData.pid,
				content: bodyEl.val(),
				title: titleEl.val(),
				topic_thumb: thumbEl.val() || ''
			}, done);
		}

		function done(err) {
			$('.action-bar button').removeAttr('disabled');
			if (err) {
				return app.alertError(err.message);
			}

			app.alertSuccess('[[success:topic-post]]');

			composer.discard(post_uuid);
			removeDraft(postData.save_id);
		}
	};

	composer.discard = function(post_uuid) {
		if (composer.posts[post_uuid]) {
			$('#cmp-uuid-' + post_uuid).remove();
			removeDraft(composer.posts[post_uuid].save_id);
			delete composer.posts[post_uuid];
			composer.active = undefined;
			taskbar.discard('composer', post_uuid);
			$('body').css({'margin-bottom': 0});
			$('.action-bar button').removeAttr('disabled');

			socket.emit('modules.composer.unregister', post_uuid);
		}
	};

	composer.minimize = function(post_uuid) {
		var postContainer = $('#cmp-uuid-' + post_uuid);
		postContainer.css('visibility', 'hidden');
		composer.active = undefined;
		taskbar.minimize('composer', post_uuid);

		socket.emit('modules.composer.unregister', post_uuid);
	};

	return {
		newTopic: composer.newTopic,
		newReply: composer.newReply,
		addQuote: composer.addQuote,
		editPost: composer.editPost,
		load: composer.load,
		minimize: composer.minimize
	};
});
