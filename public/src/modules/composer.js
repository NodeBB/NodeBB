define(function() {
	var composer = {
			initialized: false,
			active: 0,
			posts: {},
			btnContainer: undefined,
			postContainer: undefined,
			listEl: undefined
		};

	composer.init = function() {
		// Create the fixed bottom bar
		var	footerEl = document.getElementById('footer');
		
		composer.btnContainer = document.createElement('div');
		composer.btnContainer.innerHTML = '<div class="navbar-inner"><ul class="nav pull-right"></ul></div>';
		composer.btnContainer.className = 'posts-bar navbar navbar-fixed-bottom';

		composer.postContainer = document.createElement('div');
		composer.postContainer.className = 'post-window row-fluid';
		composer.postContainer.innerHTML =	'<div class="span10 offset1">' +
												'<input type="text" placeholder="Enter your topic title here..." />' +
												'<div class="btn-toolbar">' +
													'<div class="btn-group formatting-bar">' +
														'<span class="btn btn-link" tabindex="-1"><i class="icon-bold"></i></span>' +
														'<span class="btn btn-link" tabindex="-1"><i class="icon-italic"></i></span>' +
														'<span class="btn btn-link" tabindex="-1"><i class="icon-list"></i></span>' +
														'<span class="btn btn-link" tabindex="-1"><i class="icon-link"></i></span>' +
													'</div>' +
													'<div class="btn-group action-bar" style="float: right; margin-right: -12px">' +
														'<button data-action="post" class="btn" tabIndex="3"><i class="icon-ok"></i> Submit</button>' +
														'<button data-action="minimize" class="btn" tabIndex="4"><i class="icon-download-alt"></i> Minimize</button>' +
														'<button class="btn" data-action="discard" tabIndex="5"><i class="icon-remove"></i> Discard</button>' +
													'</div>' +
												'</div>' +
												'<textarea></textarea>' +
											'</div>';

		composer.listEl = composer.btnContainer.querySelector('ul');
		document.body.insertBefore(composer.btnContainer, footerEl);
		document.body.insertBefore(composer.postContainer, composer.btnContainer);

		socket.on('api:composer.push', function(threadData) {
			if (!threadData.error) {
				var	uuid = utils.generateUUID(),
					btnEl = document.createElement('li');
				btnEl.innerHTML = '<a href="#"><img src="/graph/users/' + threadData.username + '/picture" /><span>' + (!threadData.cid ? (threadData.title || '') : 'New Topic') + '</span></a>';
				btnEl.setAttribute('data-uuid', uuid);
				composer.listEl.appendChild(btnEl);
				composer.posts[uuid] = {
					tid: threadData.tid,
					cid: threadData.cid,
					pid: threadData.pid,
					title: threadData.title || '',
					body: threadData.body || ''
				};
				composer.active++;
				composer.update();
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

		// Posts bar events
		$(composer.btnContainer).on('click', 'li', function() {
			var uuid = this.getAttribute('data-uuid');
			composer.load(uuid);
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
				case 'minimize': composer.minimize(); break;
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

	composer.update = function() {
		if (composer.initialized) {
			if (composer.active > 0) {
				composer.btnContainer.setAttribute('data-active', '1');
			} else {
				composer.btnContainer.removeAttribute('data-active');
			}
		}
	}

	composer.push = function(tid, cid, pid) {
		socket.emit('api:composer.push', {
			tid: tid,	// Replying
			cid: cid,	// Posting
			pid: pid	// Editing
		});
	}

	composer.load = function(post_uuid) {
		var	post_data = composer.posts[post_uuid],
			titleEl = composer.postContainer.querySelector('input'),
			bodyEl = composer.postContainer.querySelector('textarea');

		composer.postContainer.style.display = 'block';
		composer.postContainer.style.bottom = composer.btnContainer.offsetHeight + "px";
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
		}
		bodyEl.value = post_data.body

		// Highlight the button
		$('.posts-bar li').removeClass('active');
		composer.btnContainer.querySelector('[data-uuid="' + post_uuid + '"]').className += ' active';

		// Direct user focus to the correct element
		if ((parseInt(post_data.tid) || parseInt(post_data.pid)) > 0) {
			bodyEl.focus();
		} else if (parseInt(post_data.cid) > 0) {
			titleEl.focus();
		}
	}

	composer.post = function(post_uuid) {
		// Check title and post length
		var	postData = composer.posts[post_uuid],
			titleEl = composer.postContainer.querySelector('input'),
			bodyEl = composer.postContainer.querySelector('textarea');
		if (titleEl.value.length <= 3) {
			return app.alert({
				type: 'error',
				timeout: 5000,
				title: 'Title too short',
				message: "Please enter a longer title.",
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
			// Commit
			var btnEl = composer.btnContainer.querySelector('[data-uuid="' + post_uuid + '"]');
			delete composer.posts[post_uuid];
			composer.active--;
			btnEl.parentNode.removeChild(btnEl);
			composer.minimize();
			composer.update();
		}
	}

	composer.minimize = function() {
		composer.postContainer.style.display = 'none';
		$('.posts-bar li').removeClass('active');
	}

	composer.init();

	return {
		push: composer.push,
		load: composer.load
	};
});