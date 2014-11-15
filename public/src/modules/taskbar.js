"use strict";
/*global define, app, templates*/

define('taskbar', function() {
	var taskbar = {
		initialized: false,
		init: function() {
			var self = this;

			templates.parse('modules/taskbar', {}, function(html) {
				self.taskbar = $(html);
				self.tasklist = self.taskbar.find('ul');
				$(document.body).append(self.taskbar);

				// Posts bar events
				self.taskbar.on('click', 'li', function() {
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
					return false;
				});

				taskbar.initialized = true;
			});
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
			var btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
			btnEl.remove();
			taskbar.update();
		},

		push: function(module, uuid, options) {
			var element = taskbar.tasklist.find('li[data-uuid="'+uuid+'"]');
			if(element.length) {
				return;
			}
			var title = $('<div></div>').text(options.title || 'NodeBB Task').html();

			var	btnEl = $('<li />')
				.html('<a href="#">' +
					(options.icon ? '<i class="fa ' + options.icon + '"></i> ' : '') +
					(options.image ? '<img src="' + options.image + '"/> ': '') +
					'<span>' + title + '</span>' +
					'</a>')
				.attr({
					'data-module': module,
					'data-uuid': uuid
				})
				.addClass(options.state !== undefined ? options.state : 'active');

			if (!options.state || options.state === 'active') {
				taskbar.minimizeAll();
			}

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
		},

		isActive: function(uuid) {
			var taskBtn = taskbar.tasklist.find('li[data-uuid="' + uuid + '"]');
			return taskBtn.hasClass('active');
		}
	};

	return {
		push: taskbar.push,
		discard: taskbar.discard,
		minimize: taskbar.minimize,
		toggleNew: taskbar.toggleNew,
		updateActive: taskbar.updateActive,
		isActive: taskbar.isActive,
		init: taskbar.init
	};
});
