define(['uploader'], function(uploader) {
	var Settings = {};

	Settings.init = function() {
		Settings.prepare();
	};

	Settings.prepare = function(callback) {
		// Come back in 125ms if the config isn't ready yet
		if (!app.config) {
			setTimeout(function() {
				Settings.prepare();
			}, 125);
			return;
		}

		// Populate the fields on the page from the config
		var fields = document.querySelectorAll('#content [data-field]'),
			numFields = fields.length,
			saveBtn = document.getElementById('save'),
			x, key, inputType;
		for (x = 0; x < numFields; x++) {
			key = fields[x].getAttribute('data-field');
			inputType = fields[x].getAttribute('type');
			if (fields[x].nodeName === 'INPUT') {
				if (app.config[key]) {
					switch (inputType) {
						case 'text':
						case 'password':
						case 'textarea':
						case 'number':
							fields[x].value = app.config[key];
							break;

						case 'checkbox':
							fields[x].checked = parseInt(app.config[key], 10) === 1;
							break;
					}
				}
			} else if (fields[x].nodeName === 'TEXTAREA') {
				if (app.config[key]) fields[x].value = app.config[key];
			} else if (fields[x].nodeName === 'SELECT') {
				if (app.config[key]) fields[x].value = app.config[key];
			}
		}

		saveBtn.addEventListener('click', function(e) {
			var key, value;
			e.preventDefault();

			for (x = 0; x < numFields; x++) {
				key = fields[x].getAttribute('data-field');
				if (fields[x].nodeName === 'INPUT') {
					inputType = fields[x].getAttribute('type');
					switch (inputType) {
						case 'text':
						case 'password':
						case 'textarea':
						case 'number':
							value = fields[x].value;
							break;

						case 'checkbox':
							value = fields[x].checked ? '1' : '0';
							break;
					}
				} else if (fields[x].nodeName === 'TEXTAREA') {
					value = fields[x].value;
				} else if (fields[x].nodeName === 'SELECT') {
					value = fields[x].value;
				}

				socket.emit('admin.config.set', {
					key: key,
					value: value
				}, function(err) {
					if(err) {
						return app.alert({
							alert_id: 'config_status',
							timeout: 2500,
							title: 'Changes Not Saved',
							message: 'NodeBB encountered a problem saving your changes',
							type: 'danger'
						});
					}

					app.alert({
						alert_id: 'config_status',
						timeout: 2500,
						title: 'Changes Saved',
						message: 'Your changes to the NodeBB configuration have been saved.',
						type: 'success'
					});

				});
			}
		});

		$('#uploadLogoBtn').on('click', function() {
			uploader.open(RELATIVE_PATH + '/admin/uploadlogo', {}, 0, function(image) {
				$('#logoUrl').val(image);
			});

			uploader.hideAlerts();
		});

		$('#uploadFaviconBtn').on('click', function() {
			uploader.open(RELATIVE_PATH + '/admin/uploadfavicon', {}, 0, function(icon) {
				$('#faviconUrl').val(icon);
			});

			uploader.hideAlerts();
		});

		$('#settings-tab a').click(function (e) {
			e.preventDefault();
			$(this).tab('show');
			return false;
		});

		if (typeof callback === 'function') {
			callback();
		}
	};

	Settings.remove = function(key) {
		socket.emit('admin.config.remove', key);
	};

	return Settings;
});