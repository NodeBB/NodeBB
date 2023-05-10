'use strict';


define('taskbar', ['translator', 'hooks'], function (translator, hooks) {
	const taskbar = {};
	let noTaskbar = false;
	taskbar.init = function () {
		taskbar.taskbar = $('[component="taskbar"]');
		taskbar.tasklist = taskbar.taskbar.find('ul');
		if (!taskbar.taskbar.length || !taskbar.tasklist.length) {
			noTaskbar = true;
			return;
		}
		taskbar.taskbar.on('click', 'li', async function () {
			const $btn = $(this);
			const moduleName = $btn.attr('data-module');
			const uuid = $btn.attr('data-uuid');

			const module = await app.require(moduleName);
			if (!$btn.hasClass('active')) {
				minimizeAll();
				module.load(uuid);
				taskbar.toggleNew(uuid, false);

				taskbar.tasklist.removeClass('active');
				$btn.addClass('active');
			} else {
				module.minimize(uuid);
			}
			return false;
		});

		$(window).on('action:app.loggedOut', function () {
			taskbar.closeAll();
		});
	};

	taskbar.close = async function (moduleName, uuid) {
		if (noTaskbar) {
			return;
		}
		// Sends signal to the appropriate module's .close() fn (if present)
		const btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');

		if (btnEl.length) {
			const module = await app.require(moduleName);
			if (module && typeof module.close === 'function') {
				module.close(uuid);
			}
		}
	};

	taskbar.closeAll = function (module) {
		if (noTaskbar) {
			return;
		}
		// module is optional
		let selector = '[data-uuid]';

		if (module) {
			selector = '[data-module="' + module + '"]' + selector;
		}

		taskbar.tasklist.find(selector).each(function (idx, el) {
			taskbar.close(module || el.getAttribute('data-module'), el.getAttribute('data-uuid'));
		});
	};

	taskbar.discard = function (module, uuid) {
		if (noTaskbar) {
			return;
		}
		const btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
		btnEl.remove();

		update();
	};

	taskbar.push = function (module, uuid, options, callback) {
		callback = callback || function () {};
		if (noTaskbar) {
			return callback();
		}
		const element = taskbar.tasklist.find('li[data-uuid="' + uuid + '"]');

		const data = {
			module: module,
			uuid: uuid,
			options: options,
			element: element,
		};

		hooks.fire('filter:taskbar.push', data);

		if (!element.length && data.module) {
			createTaskbarItem(data, callback);
		} else {
			callback(element);
		}
	};

	taskbar.get = function (module) {
		if (noTaskbar) {
			return [];
		}
		const items = $('[data-module="' + module + '"]').map(function (idx, el) {
			return $(el).data();
		});

		return items;
	};

	taskbar.minimize = function (module, uuid) {
		if (noTaskbar) {
			return;
		}
		const btnEl = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
		btnEl.toggleClass('active', false);
	};

	taskbar.toggleNew = function (uuid, state, silent) {
		if (noTaskbar) {
			return;
		}
		const btnEl = taskbar.tasklist.find('[data-uuid="' + uuid + '"]');
		btnEl.toggleClass('new', state);

		if (!silent) {
			hooks.fire('action:taskbar.toggleNew', uuid);
		}
	};

	taskbar.updateActive = function (uuid) {
		if (noTaskbar) {
			return;
		}

		const tasks = taskbar.tasklist.find('li');
		tasks.removeClass('active');
		tasks.filter('[data-uuid="' + uuid + '"]').addClass('active');

		$('[data-uuid]:not([data-module])').toggleClass('modal-unfocused', true);
		$('[data-uuid="' + uuid + '"]:not([data-module])').toggleClass('modal-unfocused', false);
	};

	taskbar.isActive = function (uuid) {
		if (noTaskbar) {
			return false;
		}
		const taskBtn = taskbar.tasklist.find('li[data-uuid="' + uuid + '"]');
		return taskBtn.hasClass('active');
	};

	function update() {
		if (noTaskbar) {
			return;
		}
		const tasks = taskbar.tasklist.find('li');

		if (tasks.length > 0) {
			taskbar.taskbar.attr('data-active', '1');
		} else {
			taskbar.taskbar.removeAttr('data-active');
		}
	}

	function minimizeAll() {
		if (noTaskbar) {
			return;
		}
		taskbar.tasklist.find('.active').removeClass('active');
	}

	function createTaskbarItem(data, callback) {
		if (noTaskbar) {
			return callback();
		}
		translator.translate(data.options.title, function (taskTitle) {
			const title = $('<div></div>').text(taskTitle || 'NodeBB Task').html();

			const taskbarEl = $('<li></li>')
				.addClass(data.options.className)
				.html('<a href="#"' + (data.options.image ? ' style="background-image: url(\'' + data.options.image.replace(/&#x2F;/g, '/') + '\'); background-size: cover;"' : '') + '>' +
					(data.options.icon ? '<i class="fa ' + data.options.icon + '"></i> ' : '') +
					'<span aria-label="' + title + '" component="taskbar/title">' + title + '</span>' +
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
			hooks.fire('action:taskbar.pushed', data);
			callback(taskbarEl);
		});
	}

	const processUpdate = function (element, key, value) {
		switch (key) {
			case 'title':
				element.find('[component="taskbar/title"]').text(value);
				break;
			case 'icon':
				element.find('i').attr('class', 'fa fa-' + value);
				break;
			case 'image':
				element.find('a').css('background-image', value ? 'url("' + value.replace(/&#x2F;/g, '/') + '")' : '');
				break;
			case 'background-color':
				element.find('a').css('background-color', value);
				break;
			case 'color':
				element.find('a').css('color', value);
				break;
		}
	};

	taskbar.update = function (module, uuid, options) {
		if (noTaskbar) {
			return;
		}
		const element = taskbar.tasklist.find('[data-module="' + module + '"][data-uuid="' + uuid + '"]');
		if (!element.length) {
			return;
		}
		const data = element.data();

		Object.keys(options).forEach(function (key) {
			data[key] = options[key];
			processUpdate(element, key, options[key]);
		});

		element.data(data);
	};

	return taskbar;
});
