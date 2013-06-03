define(function() {
	var composer = {
			initialized: false,
			posts: [],
			btnContainer: undefined,
			postContainer: undefined,
			listEl: undefined
		};

	composer.init = function() {
		// Create the fixed bottom bar
		var	contentEl = document.getElementById('content');
		
		composer.btnContainer = document.createElement('div');
		composer.btnContainer.innerHTML = '<div class="navbar-inner"><ul class="nav pull-right"></ul></div>';
		composer.btnContainer.className = 'posts-bar navbar navbar-fixed-bottom';

		composer.postContainer = document.createElement('div');
		composer.postContainer.className = 'post-window row-fluid';
		composer.postContainer.innerHTML = '<div class="span10 offset1"><input type="text" placeholder="Enter your topic title here..." /><textarea rows="10"></textarea></div>';

		composer.listEl = composer.btnContainer.querySelector('ul');
		document.body.insertBefore(composer.btnContainer, contentEl);
		document.body.insertBefore(composer.postContainer, composer.btnContainer);

		socket.on('api:composer.push', function(threadData) {
			console.log(threadData);
			var	uuid = utils.generateUUID(),
				btnEl = document.createElement('li');
			btnEl.innerHTML = '<a href="#"><img src="/graph/users/' + threadData.username + '/picture" /><span>' + threadData.title + '</span></a>';
			btnEl.setAttribute('data-uuid', uuid);
			composer.listEl.appendChild(btnEl);
			composer.posts.push(uuid);
			composer.update();
		});

		composer.initialized = true;
	}

	composer.update = function() {
		if (composer.initialized) {
			if (composer.posts.length > 0) {
				composer.btnContainer.setAttribute('data-active', '1');
			} else {
				composer.btnContainer.removeAttribute('data-active');
			}
		}
	}

	composer.push = function(tid) {
		socket.emit('api:composer.push', tid);
	}

	composer.init();

	return {
		push: composer.push
	};
});