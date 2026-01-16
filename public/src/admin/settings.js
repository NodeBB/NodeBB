'use strict';


define('admin/settings', [
	'uploader', 'mousetrap', 'hooks', 'alerts', 'settings', 'bootstrap', 'admin/modules/relogin-timer',
], function (uploader, mousetrap, hooks, alerts, settings, bootstrap, reloginTimer) {
	const Settings = {};

	Settings.populateTOC = function () {
		const headers = $('.settings-header');
		const tocEl = $('[component="settings/toc"]');
		const tocList = $('[component="settings/toc/list"]');
		const mainHader = $('[component="settings/main/header"]');

		if (headers.length > 1 && tocList.length) {
			headers.each(function (i) {
				const $this = $(this);
				const header = $this.text();
				const anchor = $this.parent().attr('id') || `section${i + 1}`;
				// for elements that don't have id use section{index}
				if (anchor.startsWith('section')) {
					$this.parent().attr('id', anchor);
				}
				tocList.append(`<a class="btn btn-ghost btn-sm text-xs text-start text-decoration-none" href="#${anchor}">${header}</a>`);
			});
			const offset = mainHader.outerHeight(true);
			// https://stackoverflow.com/a/11814275/583363
			tocList.find('a').on('click', function (event) {
				event.preventDefault();
				const href = $(this).attr('href');
				$(href)[0].scrollIntoView();
				window.location.hash = href;
				scrollBy(0, -offset);
				setTimeout(() => {
					tocList.find('a').removeClass('active');
					$(this).addClass('active');
				}, 10);
				return false;
			});

			new bootstrap.ScrollSpy($('#spy-container')[0], {
				target: '#settings-navbar',
				rootMargin: '-10% 0px -70%',
				smoothScroll: true,
			});

			const scrollTo = $(`${window.location.hash}`);
			if (scrollTo.length) {
				$('html, body').animate({
					scrollTop: (scrollTo.offset().top - offset) + 'px',
				}, 400);
			}
			tocEl.removeClass('hidden');
		}
	};

	Settings.prepare = function (callback) {
		// Populate the fields on the page from the config
		const fields = $('#content [data-field]');
		const numFields = fields.length;
		const saveBtn = $('#save');
		const revertBtn = $('#revert');
		let x;
		let key;
		let inputType;
		let field;

		// Handle unsaved changes
		fields.on('change', function () {
			app.flags = app.flags || {};
			app.flags._unsaved = true;
		});
		const defaultInputs = ['text', 'hidden', 'password', 'textarea', 'number'];
		for (x = 0; x < numFields; x += 1) {
			field = fields.eq(x);
			key = field.attr('data-field');
			inputType = field.attr('type');
			if (app.config.hasOwnProperty(key)) {
				if (field.is('input') && inputType === 'checkbox') {
					const checked = parseInt(app.config[key], 10) === 1;
					field.prop('checked', checked);
				} else if (field.is('textarea') || field.is('select') || (field.is('input') && defaultInputs.indexOf(inputType) !== -1)) {
					field.val(app.config[key]);
				}
			}
		}

		revertBtn.off('click').on('click', function () {
			ajaxify.refresh();
		});

		saveBtn.off('click').on('click', function (e) {
			e.preventDefault();

			const ok = settings.check(document.querySelectorAll('#content [data-field]'));
			if (!ok) {
				return;
			}

			saveFields(fields, function onFieldsSaved(err) {
				if (err) {
					return alerts.alert({
						alert_id: 'config_status',
						timeout: 2500,
						title: '[[admin/admin:changes-not-saved]]',
						message: `[[admin/admin:changes-not-saved-message, ${err.message}]]`,
						type: 'danger',
					});
				}

				app.flags._unsaved = false;
				Settings.toggleSaveSuccess(saveBtn);
				hooks.fire('action:admin.settingsSaved');
			});
		});

		mousetrap.bind('ctrl+s', function (ev) {
			saveBtn.click();
			ev.preventDefault();
		});

		handleUploads();
		setupTagsInput();

		$('#clear-sitemap-cache').off('click').on('click', function () {
			socket.emit('admin.settings.clearSitemapCache', function () {
				alerts.success('Sitemap Cache Cleared!');
			});
			return false;
		});

		if (typeof callback === 'function') {
			callback();
		}

		setTimeout(function () {
			hooks.fire('action:admin.settingsLoaded');
		}, 0);
	};

	Settings.toggleSaveSuccess = function (saveBtn) {
		const saveBtnEl = saveBtn.get(0);
		if (saveBtnEl) {
			saveBtnEl.classList.toggle('saved', true);
			setTimeout(() => {
				saveBtnEl.classList.toggle('saved', false);
			}, 1500);
		}
	};

	function handleUploads() {
		$('#content input[data-action="upload"]').each(function () {
			const uploadBtn = $(this);
			uploadBtn.on('click', function () {
				uploader.show({
					title: uploadBtn.attr('data-title'),
					description: uploadBtn.attr('data-description'),
					route: uploadBtn.attr('data-route'),
					params: {},
					showHelp: uploadBtn.attr('data-help') ? uploadBtn.attr('data-help') === 1 : undefined,
					accept: uploadBtn.attr('data-accept'),
				}, function (image) {
					$('#' + uploadBtn.attr('data-target')).val(image);
				});
			});
		});
	}

	function setupTagsInput() {
		$('[data-field-type="tagsinput"]').tagsinput({
			tagClass: 'badge bg-info',
			confirmKeys: [13, 44],
			trimValue: true,
		});
		app.flags._unsaved = false;
	}

	Settings.remove = function (key) {
		socket.emit('admin.config.remove', key);
	};

	function saveFields(fields, callback) {
		const data = {};

		fields.each(function () {
			const field = $(this);
			const key = field.attr('data-field');
			let value;
			let inputType;

			if (field.is('input')) {
				inputType = field.attr('type');
				switch (inputType) {
					case 'text':
					case 'password':
					case 'hidden':
					case 'textarea':
					case 'number':
						value = field.val();
						break;

					case 'checkbox':
						value = field.prop('checked') ? '1' : '0';
						break;
				}
			} else if (field.is('textarea') || field.is('select')) {
				value = field.val();
			}

			data[key] = value;
		});

		socket.emit('admin.config.setMultiple', data, function (err) {
			if (err) {
				return callback(err);
			}

			for (const [field, value] of Object.entries(data)) {
				app.config[field] = value;
				if (field === 'adminReloginDuration') {
					reloginTimer.start(parseInt(value, 10));
				}
			}

			callback();
		});
	}

	return Settings;
});
