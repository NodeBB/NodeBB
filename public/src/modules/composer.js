define(function() {
	var composer = {
			initialized: false,
			posts: [],
			container: undefined,
			listEl: undefined
		};

	composer.init = function() {
		// Create the fixed bottom bar
		var	contentEl = document.getElementById('content');
		
		composer.container = document.createElement('div');

		composer.container.innerHTML = '<div class="navbar-inner"><ul class="nav pull-right"></ul></div>';
		composer.container.className = 'posts-bar navbar navbar-fixed-bottom';
		composer.listEl = composer.container.querySelector('ul');
		document.body.insertBefore(composer.container, contentEl);

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
				composer.container.setAttribute('data-active', '1');
			} else {
				composer.container.removeAttribute('data-active');
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