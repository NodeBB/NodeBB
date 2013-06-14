define(function() {
	var taskbar = {
		initialized: false,
		taskbar: undefined,
		tasklist: undefined,
		init: function() {
			var	footerEl = document.getElementById('footer');
		
			taskbar.taskbar = document.createElement('div');
			taskbar.taskbar.innerHTML = '<div class="navbar-inner"><ul class="nav pull-right"></ul></div>';
			taskbar.taskbar.className = 'taskbar navbar navbar-fixed-bottom';
			taskbar.taskbar.id = 'taskbar';

			taskbar.tasklist = taskbar.taskbar.querySelector('ul');
			document.body.insertBefore(taskbar.taskbar, footerEl);

			// Posts bar events
			$(taskbar.taskbar).on('click', 'li', function() {
				var	module = this.getAttribute('data-module'),
					uuid = this.getAttribute('data-uuid');

				require([module], function(module) {
					module.load(uuid);

					// Highlight the button
					$(taskbar.tasklist).removeClass('active');
					this.className += ' active';
				});
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
			var	btnEl = document.createElement('li');

			btnEl.innerHTML =	'<a href="#">' +
									(options.icon ? '<img src="' + options.icon + '" />' : '') +
									'<span>' + (options.title || 'NodeBB Task') + '</span>' +
								'</a>';
			btnEl.setAttribute('data-module', module);
			btnEl.setAttribute('data-uuid', uuid);
			taskbar.tasklist.appendChild(btnEl);

			taskbar.update();
		},
		minimize: function(module, uuid) {
			var btnEl = taskbar.tasklist.querySelector('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
			$(btnEl).removeClass('active');
		}
	}

	if (!taskbar.initialized) taskbar.init();

	return {
		push: taskbar.push,
		discard: taskbar.discard,
		minimize: taskbar.minimize
	}
});