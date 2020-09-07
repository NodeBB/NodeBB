'use strict';


define('taskbar', ['benchpress', 'translator'], function (Benchpress, translator) {
	var taskbar = {};

	taskbar.init = function () {
		var self = this;

		Benchpress.parse('modules/taskbar', {}, function (html) {
			self.taskbar = $(html);
			self.tasklist = self.taskbar.find('ul');
			$(document.body).append(self.taskbar);

			self.taskbar.on('click', 'li', function () {
				var	$btn = $(this);
				var module = $btn.attr('data-module');
				var uuid = $btn.attr('data-uuid');

				require([module], function (module) {
					if (!$btn.hasClass('active')) {
						minimizeAll();
						module.load(uuid);
						taskbar.toggleNew(uuid, false);

						taskbar.tasklist.removeClass('active');
						$btn.addClass('active');
					} else {
						module.minimize(uuid);
					}
				});

				return false;
			});
		});

		$(window).on('action:app.loggedOut', function () {
			taskbar.closeAll();
		});
	};

	taskbar.close = function (module, uuid) {
		// Sends signal to the appropriate module's .close() fn (if present)
		var btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
		var fnName = 'close';

		// TODO: Refactor chat module to not take uuid in close instead of by jQuery element
		if (module === 'chat') {
			fnName = 'closeByUUID';
		}

		if (btnEl.length) {
			require([module], function (module) {
				if (typeof module[fnName] === 'function') {
					module[fnName](uuid);
				}
			});
		}
	};

	taskbar.closeAll = function (module) {
		// module is optional
		var selector = '[data-uuid]';

		if (module) {
			selector = '[data-module="' + module + '"]' + selector;
		}

		taskbar.tasklist.find(selector).each(function (idx, el) {
			taskbar.close(module || el.getAttribute('data-module'), el.getAttribute('data-uuid'));
		});
	};

	taskbar.discard = function (module, uuid) {
		var btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
		btnEl.remove();

		update();
	};

	taskbar.push = function (module, uuid, options, callback) {
		callback = callback || function () {};
		var element = taskbar.tasklist.find('li[data-uuid="' + uuid + '"]');

		var data = {
			module: module,
			uuid: uuid,
			options: options,
			element: element,
		};

		$(window).trigger('filter:taskbar.push', data);

		if (!element.length && data.module) {
			createTaskbarItem(data, callback);
		} else {
			callback(element);
		}
	};

	taskbar.get = function (module) {
		var items = $('[data-module="' + module + '"]').map(function (idx, el) {
			return $(el).data();
		});

		return items;
	};

	taskbar.minimize = function (module, uuid) {
		var btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
		btnEl.toggleClass('active', false);
	};

	taskbar.toggleNew = function (uuid, state, silent) {
		var btnEl = taskbar.tasklist.find('[data-uuid="' + uuid + '"]');
		btnEl.toggleClass('new', state);

		if (!silent) {
			$(window).trigger('action:taskbar.toggleNew', uuid);
		}
	};

	taskbar.updateActive = function (uuid) {
		var	tasks = taskbar.tasklist.find('li');
		tasks.removeClass('active');
		tasks.filter('[data-uuid="' + uuid + '"]').addClass('active');

		$('[data-uuid]:not([data-module])').toggleClass('modal-unfocused', true);
		$('[data-uuid="' + uuid + '"]:not([data-module])').toggleClass('modal-unfocused', false);
	};

	taskbar.isActive = function (uuid) {
		var taskBtn = taskbar.tasklist.find('li[data-uuid="' + uuid + '"]');
		return taskBtn.hasClass('active');
	};

	function update() {
		var	tasks = taskbar.tasklist.find('li');

		if (tasks.length > 0) {
			taskbar.taskbar.attr('data-active', '1');
		} else {
			taskbar.taskbar.removeAttr('data-active');
		}
	}

	function minimizeAll() {
		taskbar.tasklist.find('.active').removeClass('active');
	}

	function createTaskbarItem(data, callback) {
		translator.translate(data.options.title, function (taskTitle) {
			var title = $('<div></div>').text(taskTitle || 'NodeBB Task').html();

			var	taskbarEl = $('<li></li>')
				.addClass(data.options.className)
				.html('<a href="#"' + (data.options.image ? ' style="background-image: url(\'' + data.options.image + '\'); background-size: cover;"' : '') + '>' +
					(data.options.icon ? '<i class="fa ' + data.options.icon + '"></i> ' : '') +
					'<span component="taskbar/title">' + title + '</span>' +
					'</a>')
				.attr({
					title: title,
					'data-module': data.module,
					'data-uuid': data.uuid,
				})
				.addClass(data.options.state !== undefined ? data.options.state : 'active');

			if (!data.options.state || data.options.state === 'active') {
				minimizeAll();
			}

			taskbar.tasklist.append(taskbarEl);
			update();

			data.element = taskbarEl;

			taskbarEl.data(data);
			$(window).trigger('action:taskbar.pushed', data);
			callback(taskbarEl);
		});
	}

	var processUpdate = function (element, key, value) {
		switch (key) {
			case 'title':
				element.find('[component="taskbar/title"]').text(value);
				break;
			case 'icon':
				element.find('i').attr('class', 'fa fa-' + value);
				break;
			case 'image':
				element.find('a').css('background-image', 'url("' + value + '")');
				break;
			case 'background-color':
				element.find('a').css('background-color', value);
				break;
		}
	};

	taskbar.update = function (module, uuid, options) {
		var element = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
		if (!element.length) {
			return;
		}
		var data = element.data();

		Object.keys(options).forEach(function (key) {
			data[key] = options[key];
			processUpdate(element, key, options[key]);
		});

		element.data(data);
	};

	taskbar.updateTitle = function (module, uuid, newTitle) {
		console.warn('[taskbar] .updateTitle() is deprecated, use .update() instead');
		taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"] [component="taskbar/title"]').text(newTitle);
	};

	return taskbar;
});
