define(function() {
	var taskbar = {
		initialized: false,
		taskbar: undefined,
		tasklist: undefined,
		init: function() {
			var	footerEl = document.getElementById('footer');

			taskbar.taskbar = document.createElement('div');
			var jTaskbar = $(taskbar.taskbar);
			taskbar.taskbar.innerHTML = '<div class="navbar-inner"><ul class="nav navbar-nav pull-right"></ul></div>';
			taskbar.taskbar.className = 'taskbar navbar navbar-default navbar-fixed-bottom';
			taskbar.taskbar.id = 'taskbar';

			taskbar.tasklist = taskbar.taskbar.querySelector('ul');
			document.body.insertBefore(taskbar.taskbar, footerEl.nextSibling);

			// Posts bar events
			jTaskbar.on('click', 'li', function() {
				var	_btn = this,
					module = this.getAttribute('data-module'),
					uuid = this.getAttribute('data-uuid');

				require([module], function(module) {
					if (_btn.className.indexOf('active') === -1) {
						taskbar.minimizeAll();
						module.load(uuid);
						taskbar.toggleNew(uuid, false);
						app.alternatingTitle('');

						// Highlight the button
						$(taskbar.tasklist).removeClass('active');
						_btn.className += ' active';
					} else {
						module.minimize(uuid);
					}
				});
			});

			jTaskbar.on('click', 'li a', function(e) {
				e.preventDefault();
			});

			taskbar.initialized = true;
		},
		update: function() {
			var	tasks = taskbar.tasklist.querySelectorAll('li');

			if (tasks.length > 0) {
				taskbar.taskbar.setAttribute('data-active', '1');
			} else {
				taskbar.taskbar.removeAttribute('data-active');
			}
		},
		discard: function(module, uuid) {
			// Commit
			var btnEl = taskbar.tasklist.querySelector('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
			btnEl.parentNode.removeChild(btnEl);
			taskbar.update();
		},
		push: function(module, uuid, options) {
			var element = $(taskbar.tasklist).find('li[data-uuid="'+uuid+'"]');
			if(element.length)
				return;

			var	btnEl = document.createElement('li');

			btnEl.innerHTML =	'<a href="#">' +
									(options.icon ? '<img src="' + options.icon + '" />' : '') +
									'<span>' + (options.title || 'NodeBB Task') + '</span>' +
								'</a>';
			btnEl.setAttribute('data-module', module);
			btnEl.setAttribute('data-uuid', uuid);
			btnEl.className = options.state !== undefined ? options.state : 'active';

			if (!options.state || options.state === 'active') taskbar.minimizeAll();
			taskbar.tasklist.appendChild(btnEl);

			taskbar.update();
		},
		minimize: function(module, uuid) {
			var btnEl = taskbar.tasklist.querySelector('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
			$(btnEl).removeClass('active');
		},
		minimizeAll: function() {
			$(taskbar.tasklist.querySelectorAll('.active')).removeClass('active');
		},
		toggleNew: function(uuid, state) {
			var btnEl = $(taskbar.tasklist.querySelector('[data-uuid="' + uuid + '"]'));
			btnEl.toggleClass('new', state);
		},
		updateActive: function(uuid) {
			var	tasks = $(taskbar.tasklist).find('li');
			tasks.removeClass('active');
			tasks.filter('[data-uuid="' + uuid + '"]').addClass('active');
		}
	}

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