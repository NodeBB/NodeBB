define(['uploader'], function(uploader) {
	var Settings = {};

	Settings.init = function() {
		Settings.prepare();
	};

	Settings.prepare = function() {
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
						case 'textarea':
						case 'number':
							fields[x].value = app.config[key];
							break;

						case 'checkbox':
							fields[x].checked = app.config[key] === '1' ? true : false;
							break;
					}
				}
			} else if (fields[x].nodeName === 'TEXTAREA') {
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
						case 'number':
							value = fields[x].value;
							break;

						case 'checkbox':
							value = fields[x].checked ? '1' : '0';
							break;
					}
				} else if (fields[x].nodeName === 'TEXTAREA') {
					value = fields[x].value;
				}

				socket.emit('api:config.set', {
					key: key,
					value: value
				});
			}
		});

		$('#uploadLogoBtn').on('click', function() {

			uploader.open(config.relative_path + '/admin/uploadlogo', function(image) {
				$('#logoUrl').val(image);
			});

			uploader.hideAlerts();
		});
	};

	Settings.remove = function(key) {
		socket.emit('api:config.remove', key);
	};

	return Settings;
});