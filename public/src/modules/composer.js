define(['taskbar'], function(taskbar) {
	var composer = {
		active: undefined,
		posts: {}
	};

	function allowed() {
		if(!(parseInt(app.uid, 10) > 0 || config.allowGuestPosting)) {
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
			return false;
		}
		return true;
	}

	composer.newTopic = function(cid) {
		if(allowed()) {
			push({
				cid: cid,
				title: '',
				body: '',
				modified: false
			});
		}
	}

	composer.addQuote = function(tid, pid, title, username, text){
		if (allowed()) {
			var uuid = composer.active;
			if(uuid !== undefined){
				var bodyEl = $('#cmp-uuid-'+uuid).find('textarea');
				var prevText = bodyEl.val();
				if(tid !== composer.posts[uuid].tid) {
					text = username + ' said in ['+title+'](/topic/'+tid+'#'+pid+'):\n'+text;
				}else {
					text = username + ' said:\n' + text;
				}
				composer.posts[uuid].body = (prevText.length ? prevText + '\n\n' : '') + text;
				bodyEl.val(composer.posts[uuid].body);
			}else{
				composer.newReply(tid,title,username + ' said:\n' + text);
			}

		}
	};

	composer.newReply = function(tid, title, text) {
		if(allowed()) {
			push({
				tid: tid,
				title: title,
				body: text,
				modified: false
			});
		}
	}

	composer.editPost = function(pid) {
		if(allowed()) {
			socket.emit('modules.composer.push', pid, function(err, threadData) {
				if(err) {
					return app.alertError(err.message);
				}
				push({
					pid: pid,
					title: threadData.title,
					body: threadData.body,
					modified: false
				});
			});
		}
	}

	function push(post) {
		var uuid = utils.generateUUID();

		taskbar.push('composer', uuid, {
			title: post.title ? post.title : 'New Topic',
			icon: post.picture
		});

		composer.posts[uuid] = post;

		composer.load(uuid);
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

			if(config.allowFileUploads || config.imgurClientIDSet) {
				initializeFileReader(post_uuid);
			}

			var postData = composer.posts[post_uuid],
				titleEl = postContainer.find('.title'),
				bodyEl = postContainer.find('textarea');

			if (parseInt(postData.tid) > 0) {
				titleEl.val('Replying to: ' + postData.title);
				titleEl.prop('disabled', true);
			} else if (parseInt(postData.pid) > 0) {
				titleEl.val(postData.title);
				titleEl.prop('disabled', true);
				socket.emit('modules.composer.editCheck', postData.pid, function(err, editCheck) {
					if (!err && editCheck.titleEditable) {
						titleEl.prop('disabled', false);
					}
				});
			} else {
				titleEl.val(postData.title);
				titleEl.prop('disabled', false);
			}

			bodyEl.val(postData.body);


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
						insertIntoInput(postContentEl, "\n* list item");
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

			postContainer.on('click', '.formatting-bar span .fa-picture-o, .formatting-bar span .fa-upload', function() {
				$('#files').click();
			});

			$('#files').on('change', function(e) {
				var files = e.target.files;
				if(files) {
					for (var i=0; i<files.length; i++) {
						loadFile(post_uuid, files[i]);
					}
				}
				$('#fileForm')[0].reset();
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
  					postContainer.find('.preview').html(preview);
  				});
			});


			var	resizeActive = false,
				resizeCenterY = 0,
				resizeOffset = 0,
				resizeStart = function(e) {
					resizeRect = resizeEl.getBoundingClientRect();
					resizeCenterY = resizeRect.top + (resizeRect.height/2);
					resizeOffset = resizeCenterY - e.clientY;
					resizeActive = true;

					$(window).on('mousemove', resizeAction);
					$(window).on('mouseup', resizeStop);
					document.body.addEventListener('touchmove', resizeTouchAction);
				},
				resizeStop = function() {
					resizeActive = false;
					bodyEl.focus();
					$(window).off('mousemove', resizeAction);
					$(window).off('mouseup', resizeStop);
					document.body.removeEventListener('touchmove', resizeTouchAction);
				},
				resizeTouchAction = function(e) {
					e.preventDefault();
					resizeAction(e.touches[0]);
				},
				resizeAction = function(e) {
					if (resizeActive) {
						position = (e.clientY + resizeOffset);
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

			var resizeEl = postContainer.find('.resizer')[0];

			resizeEl.addEventListener('mousedown', resizeStart);

			resizeEl.addEventListener('touchstart', function(e) {
				e.preventDefault();
				resizeStart(e.touches[0]);
			});
			resizeEl.addEventListener('touchend', function(e) {
				e.preventDefault();
				resizeStop();
			});
				// .on('mousedown touchstart', resizeStart)
				// .on('mouseup touchend', resizeStop)

			window.addEventListener('resize', function() {
				if (composer.active !== undefined) {
					composer.activateReposition(composer.active);
				}
			});
		});
	}

	//http://stackoverflow.com/questions/14441456/how-to-detect-which-device-view-youre-on-using-twitter-bootstrap-api
	function findBootstrapEnvironment() {
		var envs = ['xs', 'sm', 'md', 'lg'];

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

	composer.activateReposition = function(post_uuid) {

		if(composer.active && composer.active !== post_uuid) {
			composer.minimize(composer.active);
		}

		var	percentage = localStorage.getItem('composer:resizePercentage'),
			bodyRect = document.body.getBoundingClientRect(),
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

		if(config.imgurClientIDSet) {
			if(env === 'md' || env === 'lg') {
				postContainer.find('.upload-instructions').removeClass('hide');
			}
			postContainer.find('.img-upload-btn').removeClass('hide');
		}

		if(config.allowFileUploads) {
			postContainer.find('.file-upload-btn').removeClass('hide');
		}

		postContainer.css('visibility', 'visible')
			.css('z-index', 2);

		$('body').css({'margin-bottom': postContainer.css('height')});

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

		var checkTitle = parseInt(postData.cid, 10) || parseInt(postData.pid, 10);

		if(postData.uploadsInProgress && postData.uploadsInProgress.length) {
			return composerAlert('Still uploading', 'Please wait for uploads to complete.');
		} else if (checkTitle && titleEl.val().length < parseInt(config.minimumTitleLength, 10)) {
			return composerAlert('Title too short', 'Please enter a longer title. At least ' + config.minimumTitleLength+ ' characters.');
		} else if (checkTitle && titleEl.val().length > parseInt(config.maximumTitleLength, 10)) {
			return composerAlert('Title too long', 'Please enter a shorter title. Titles can\'t be longer than ' + config.maximumTitleLength + ' characters.');
		} else if (bodyEl.val().length < parseInt(config.minimumPostLength, 10)) {
			return composerAlert('Content too short', 'Please enter a longer post. At least ' + config.minimumPostLength + ' characters.');
		}

		if (parseInt(postData.cid, 10) > 0) {
			socket.emit('topics.post', {
				'title' : titleEl.val(),
				'content' : bodyEl.val(),
				'category_id' : postData.cid
			}, done);
		} else if (parseInt(postData.tid, 10) > 0) {
			socket.emit('posts.reply', {
				'topic_id' : postData.tid,
				'content' : bodyEl.val()
			}, done);
		} else if (parseInt(postData.pid, 10) > 0) {
			socket.emit('posts.edit', {
				pid: postData.pid,
				content: bodyEl.val(),
				title: titleEl.val()
			}, done);
		}

		function done(err) {
			$('.action-bar button').removeAttr('disabled');
			if(!err) {
				composer.discard(post_uuid);
			}
		}
	}

	function composerAlert(title, message) {
		$('.action-bar button').removeAttr('disabled');
		app.alert({
			type: 'danger',
			timeout: 2000,
			title: title,
			message: message,
			alert_id: 'post_error'
		});
	}

	composer.discard = function(post_uuid) {
		if (composer.posts[post_uuid]) {
			$('#cmp-uuid-' + post_uuid).remove();
			delete composer.posts[post_uuid];
			composer.active = undefined;
			taskbar.discard('composer', post_uuid);
			$('body').css({'margin-bottom': 0});
			$('.action-bar button').removeAttr('disabled');
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
				tabContent = postContainer.find('.tab-content'),
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
				drop.css('top', tabContent.position().top + 'px');
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

			$(window).off('paste').on('paste', function(event) {
				var items = (event.clipboardData || event.originalEvent.clipboardData).items;
				if(items && items.length) {
					var blob = items[0].getAsFile();
					loadFile(post_uuid, blob);
				}
			});
		}
	}

	function loadFile(post_uuid, file) {
		var reader = new FileReader(),
			dropDiv = $('#cmp-uuid-' + post_uuid).find('.imagedrop');

		$(reader).on('loadend', function(e) {
			var regex = /^data:.*;base64,(.*)$/;
			var matches = this.result.match(regex);

			var fileData = {
				name: file.name || '',
				data: matches[1]
			};

			dropDiv.hide();

			if(file.type.match('image.*')) {
				uploadFile('posts.uploadImage', post_uuid, fileData);
			} else {
				if(file.size > parseInt(config.maximumFileSize, 10) * 1024) {
					return composerAlert('File too big', 'Maximum allowed file size is ' + config.maximumFileSize + 'kbs');
				}
				uploadFile('posts.uploadFile', post_uuid, fileData);
			}
		});

		reader.readAsDataURL(file);
	}


	function uploadFile(method, post_uuid, img) {
		var linkStart = method === 'posts.uploadImage' ? '!' : '',
			postContainer = $('#cmp-uuid-' + post_uuid),
			textarea = postContainer.find('textarea'),
			text = textarea.val(),
			imgText = linkStart + '[' + img.name + '](uploading...)';

		text += imgText;
		textarea.val(text + " ");

		if(!composer.posts[post_uuid].uploadsInProgress) {
			composer.posts[post_uuid].uploadsInProgress = [];
		}

		composer.posts[post_uuid].uploadsInProgress.push(1);

		socket.emit(method, img, function(err, data) {

			var currentText = textarea.val();

			if(err) {
				textarea.val(currentText.replace(imgText, linkStart + '[' + img.name + '](upload error)'));
				return app.alertError(err.message);
			}

			textarea.val(currentText.replace(imgText, linkStart + '[' + data.name + '](' + data.url + ')'));

			composer.posts[post_uuid].uploadsInProgress.pop();
		});
	}

	return {
		newTopic: composer.newTopic,
		newReply: composer.newReply,
		addQuote: composer.addQuote,
		editPost: composer.editPost,
		load: composer.load,
		minimize: composer.minimize
	};
});