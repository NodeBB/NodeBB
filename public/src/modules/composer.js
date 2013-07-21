define(['taskbar'], function(taskbar) {
	var composer = {
			initialized: false,
			active: 0,
			taskbar: taskbar,
			posts: {},
			postContainer: undefined,
		};

	function loadFile(file) {
		var reader = new FileReader();
		var dropDiv = $('#imagedrop');
		var uuid = dropDiv.parents('[data-uuid]').attr('data-uuid');
		var posts = composer.posts[uuid];
		
		$(reader).on('loadend', function(e) {
			var bin = this.result; 
			bin = bin.split(',')[1];

			var img = {
				name: file.name,
				data: bin
			};

			posts.images.push(img);

			var imageLabel = $('<div class="label"><span>'+ file.name +'</span></div>');
			var closeButton = $('<button class="close">&times;</button>');
			closeButton.on('click', function(e) {
				
				imageLabel.remove();
				var index = posts.images.indexOf(img);
				if(index !== -1) {
					posts.images.splice(index, 1);
				}
				
				if(!dropDiv.children().length) {
					dropDiv.html('Drag and drop images here');
				}
			});

			imageLabel.append(closeButton);      	
    		dropDiv.append(imageLabel);

		});
	
		reader.readAsDataURL(file);
	}

	function initializeFileReader() {
		jQuery.event.props.push( "dataTransfer" );
		
		if(window.FileReader) {
			var drop = $('#imagedrop');

			$(composer.postContainer).on('dragenter dragover', function() {
				drop.show();	
			});
			
			function cancel(e) {
				e.preventDefault();
				return false;
			}
			
			drop.on('dragover', cancel);
			drop.on('dragenter', cancel);
			
			drop.on('drop', function(e) {
				e.preventDefault();
				var uuid = drop.parents('[data-uuid]').attr('data-uuid');
				var posts = composer.posts[uuid];			
				
				var dt = e.dataTransfer;
				var files = dt.files;
				
				if(!posts.images.length)
					drop.html('');
				
				for (var i=0; i<files.length; i++) {
					loadFile(files[i]);
				}
				return false;
				
			});
			
		}
	}

	composer.init = function() {
		if (!composer.initialized) {
			var taskbar = document.getElementById('taskbar');

			composer.postContainer = document.createElement('div');
			composer.postContainer.className = 'post-window row-fluid';
			composer.postContainer.innerHTML =	'<div class="span10 offset1">' +
													'<input type="text" tabIndex="1" placeholder="Enter your topic title here..." />' +
													'<div class="btn-toolbar">' +
														'<div class="btn-group formatting-bar">' +
															'<span class="btn btn-link" tabindex="-1"><i class="icon-bold"></i></span>' +
															'<span class="btn btn-link" tabindex="-1"><i class="icon-italic"></i></span>' +
															'<span class="btn btn-link" tabindex="-1"><i class="icon-list"></i></span>' +
															'<span class="btn btn-link" tabindex="-1"><i class="icon-link"></i></span>' +
														'</div>' +
														'<div class="btn-group action-bar" style="float: right; margin-right: -12px">' +
															'<button data-action="post" class="btn" tabIndex="3"><i class="icon-ok"></i> Submit</button>' +
															'<button data-action="minimize" class="btn hidden-phone" tabIndex="4"><i class="icon-download-alt"></i> Minimize</button>' +
															'<button class="btn" data-action="discard" tabIndex="5"><i class="icon-remove"></i> Discard</button>' +
														'</div>' +
													'</div>' +
													'<div id="imagedrop" style="display:none;"></div>'+
													'<textarea tabIndex="2"></textarea>' +
												'</div>';

			document.body.insertBefore(composer.postContainer, taskbar);

			initializeFileReader();

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
						images: []
					};
					composer.load(uuid);
				} else {
					app.alert({
						type: 'error',
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
				postContentEl = composer.postContainer.querySelector('textarea')
			jPostContainer.on('change', 'input, textarea', function() {
				var uuid = $(this).parents('.post-window')[0].getAttribute('data-uuid');
				if (this.nodeName === 'INPUT') composer.posts[uuid].title = this.value;
				else if (this.nodeName === 'TEXTAREA') composer.posts[uuid].body = this.value;
			});
			jPostContainer.on('click', '.action-bar button', function() {
				var	action = this.getAttribute('data-action'),
					uuid = $(this).parents('.post-window').attr('data-uuid');
				switch(action) {
					case 'post': composer.post(uuid); break;
					case 'minimize': composer.minimize(uuid); break;
					case 'discard': composer.discard(uuid); break;
				}
			});
			jPostContainer.on('click', '.formatting-bar span', function() {
				var iconClass = this.querySelector('i').className,
					cursorEnd = postContentEl.value.length,
					selectionStart = postContentEl.selectionStart,
					selectionEnd = postContentEl.selectionEnd,
					selectionLength = selectionEnd - selectionStart;

				switch(iconClass) {
					case 'icon-bold':
						if (selectionStart === selectionEnd) {
							// Nothing selected
							postContentEl.value = postContentEl.value + '**bolded text**';
							postContentEl.selectionStart = cursorEnd+2;
							postContentEl.selectionEnd = postContentEl.value.length - 2;
						} else {
							// Text selected
							postContentEl.value = postContentEl.value.slice(0, selectionStart) + '**' + postContentEl.value.slice(selectionStart, selectionEnd) + '**' + postContentEl.value.slice(selectionEnd);
							postContentEl.selectionStart = selectionStart + 2;
							postContentEl.selectionEnd = selectionEnd + 2;
						}
					break;
					case 'icon-italic':
						if (selectionStart === selectionEnd) {
							// Nothing selected
							postContentEl.value = postContentEl.value + '*italicised text*';
							postContentEl.selectionStart = cursorEnd+1;
							postContentEl.selectionEnd = postContentEl.value.length - 1;
						} else {
							// Text selected
							postContentEl.value = postContentEl.value.slice(0, selectionStart) + '*' + postContentEl.value.slice(selectionStart, selectionEnd) + '*' + postContentEl.value.slice(selectionEnd);
							postContentEl.selectionStart = selectionStart + 1;
							postContentEl.selectionEnd = selectionEnd + 1;
						}
					break;
					case 'icon-list':
						// Nothing selected
						postContentEl.value = postContentEl.value + "\n\n* list item";
						postContentEl.selectionStart = cursorEnd+4;
						postContentEl.selectionEnd = postContentEl.value.length;
					break;
					case 'icon-link':
						if (selectionStart === selectionEnd) {
							// Nothing selected
							postContentEl.value = postContentEl.value + '[link text](link url)';
							postContentEl.selectionStart = cursorEnd+12;
							postContentEl.selectionEnd = postContentEl.value.length - 1;
						} else {
							// Text selected
							postContentEl.value = postContentEl.value.slice(0, selectionStart) + '[' + postContentEl.value.slice(selectionStart, selectionEnd) + '](link url)' + postContentEl.value.slice(selectionEnd);
							postContentEl.selectionStart = selectionStart + selectionLength + 3;
							postContentEl.selectionEnd = selectionEnd + 11;
						}
					break;
				}
			});

			composer.initialized = true;
		}
	}

	composer.push = function(tid, cid, pid, text) {
		socket.emit('api:composer.push', {
			tid: tid,	// Replying
			cid: cid,	// Posting
			pid: pid,	// Editing
			body: text	// Predefined text
		});
	}

	composer.load = function(post_uuid) {
		var post_data = composer.posts[post_uuid],
			titleEl = composer.postContainer.querySelector('input'),
			bodyEl = composer.postContainer.querySelector('textarea'),
			dropDiv = $(composer.postContainer).find('#imagedrop');	

		dropDiv.html('Drag and drop images here').hide();

		composer.postContainer.style.display = 'block';
		// composer.postContainer.style.bottom = composer.btnContainer.offsetHeight + "px";
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
		bodyEl.value = post_data.body

		

		// Direct user focus to the correct element
		if ((parseInt(post_data.tid) || parseInt(post_data.pid)) > 0) {
			bodyEl.focus();
			bodyEl.selectionStart = bodyEl.value.length;
			bodyEl.selectionEnd = bodyEl.value.length;
		} else if (parseInt(post_data.cid) > 0) {
			titleEl.focus();
		}
	}

	composer.post = function(post_uuid) {
		// Check title and post length
		var	postData = composer.posts[post_uuid],
			titleEl = composer.postContainer.querySelector('input'),
			bodyEl = composer.postContainer.querySelector('textarea');
		
		if (titleEl.value.length < 3) {
			return app.alert({
				type: 'error',
				timeout: 2000,
				title: 'Title too short',
				message: "Please enter a longer title. At least 3 characters.",
				alert_id: 'post_error'
			});
		}

		if (bodyEl.value.length < 8) {
			return app.alert({
				type: 'error',
				timeout: 2000,
				title: 'Content too short',
				message: "Please enter a longer post. At least 8 characters.",
				alert_id: 'post_error'
			});
		}

		// Still here? Let's post.
		if (parseInt(postData.cid) > 0) {
			socket.emit('api:topics.post', {
				'title' : titleEl.value,
				'content' : bodyEl.value,
				'category_id' : postData.cid,
				images: composer.posts[post_uuid].images
			});
		} else if (parseInt(postData.tid) > 0) {
			socket.emit('api:posts.reply', {
				'topic_id' : postData.tid,
				'content' : bodyEl.value,
				images: composer.posts[post_uuid].images
			});
		} else if (parseInt(postData.pid) > 0) {
			socket.emit('api:posts.edit', {
				pid: postData.pid,
				content: bodyEl.value,
				title: titleEl.value,
				images: composer.posts[post_uuid].images
			});
		}

		composer.discard(post_uuid);
	}

	composer.discard = function(post_uuid) {
		if (composer.posts[post_uuid]) {
			$(composer.postContainer).find('#imagedrop').html('');
			delete composer.posts[post_uuid];
			composer.minimize();
			taskbar.discard('composer', post_uuid);
		}
	}

	composer.minimize = function(uuid) {
		composer.postContainer.style.display = 'none';
		taskbar.minimize('composer', uuid);
	}

	composer.init();

	return {
		push: composer.push,
		load: composer.load,
		minimize: composer.minimize
	};
});