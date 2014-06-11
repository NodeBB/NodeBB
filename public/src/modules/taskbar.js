define('taskbar', function() {
	var taskbar = {
		initialized: false,
		init: function() {
			this.taskbar = $('<div />')
				.html('<div class="navbar-inner"><ul class="nav navbar-nav pull-right"></ul></div>')
				.addClass('taskbar navbar navbar-default navbar-fixed-bottom')
				.attr('id', 'taskbar');

			this.tasklist = this.taskbar.find('ul');
			$(document.body).append(this.taskbar);

			// Posts bar events
			this.taskbar.on('click', 'li', function() {
				var	$btn = $(this),
					module = $btn.attr('data-module'),
					uuid = $btn.attr('data-uuid');

				require([module], function(module) {
					if (!$btn.hasClass('active')) {
						taskbar.minimizeAll();
						module.load(uuid);
						taskbar.toggleNew(uuid, false);
						app.alternatingTitle('');

						// Highlight the button
						taskbar.tasklist.removeClass('active');
						$btn.addClass('active');
					} else {
						module.minimize(uuid);
					}
				});
			});

			this.taskbar.on('click', 'li a', function(e) {
				e.preventDefault();
			});

			taskbar.initialized = true;
		},

		update: function() {
			var	tasks = taskbar.tasklist.find('li');

			if (tasks.length > 0) {
				taskbar.taskbar.attr('data-active', '1');
			} else {
				taskbar.taskbar.removeAttr('data-active');
			}
		},

		discard: function(module, uuid) {
			// Commit
			var btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
			btnEl.remove();
			taskbar.update();
		},

		push: function(module, uuid, options) {
			var element = taskbar.tasklist.find('li[data-uuid="'+uuid+'"]');
			if(element.length)
				return;
			var title = $('<div></div>').html(options.title || 'NodeBB Task').text();

			var	btnEl = $('<li />')
				.html('<a href="#">' +
					(options.icon ? '<img src="' + options.icon + '" />' : '') +
					'<span>' + title + '</span>' +
					'</a>')
				.attr({
					'data-module': module,
					'data-uuid': uuid
				})
				.addClass(options.state !== undefined ? options.state : 'active');

			if (!options.state || options.state === 'active') taskbar.minimizeAll();
			taskbar.tasklist.append(btnEl);

			taskbar.update();
		},

		minimize: function(module, uuid) {
			var btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
			btnEl.removeClass('active');
		},

		minimizeAll: function() {
			taskbar.tasklist.find('.active').removeClass('active');
		},

		toggleNew: function(uuid, state) {
			var btnEl = taskbar.tasklist.find('[data-uuid="' + uuid + '"]');
			btnEl.toggleClass('new', state);
		},

		updateActive: function(uuid) {
			var	tasks = taskbar.tasklist.find('li');
			tasks.removeClass('active');
			tasks.filter('[data-uuid="' + uuid + '"]').addClass('active');
		}
	};

	if (!taskbar.initialized) {
		taskbar.init();
	}

	return {
		push: taskbar.push,
		discard: taskbar.discard,
		minimize: taskbar.minimize,
		toggleNew: taskbar.toggleNew,
		updateActive: taskbar.updateActive
	}
});
