define(function() {
	var Settings = {};

	Settings.config = {};

	Settings.init = function() {
		Settings.prepare();
	};

	Settings.prepare = function() {	
		console.dir(Settings.config);
		// Come back in 500ms if the config isn't ready yet
		if (Settings.config === undefined) {
			setTimeout(function() {
				Settings.prepare();
			}, 500);
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
				if (Settings.config[key]) {
					switch (inputType) {
						case 'text':
						case 'textarea':
						case 'number':
							fields[x].value = Settings.config[key];
							break;

						case 'checkbox':
							fields[x].checked = Settings.config[key] === '1' ? true : false;
							break;
					}
				}
			} else if (fields[x].nodeName === 'TEXTAREA') {
				if (Settings.config[key]) fields[x].value = Settings.config[key];
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
	};

	Settings.remove = function(key) {
		socket.emit('api:config.remove', key);
	};

	return Settings;
});