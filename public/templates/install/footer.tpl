
	</div>
	<script>
		var nodebb_setup = {
			config: undefined,
			prepare: function() {
				// Bounce if config is not ready
				// if (nodebb_setup.config === undefined) {
				// 	ajaxify.go('install/redis');
				// 	app.alert({
				// 		alert_id: 'config-ready',
				// 		type: 'error',
				// 		timeout: 10000,
				// 		title: 'NodeBB Configuration Not Ready!',
				// 		message:	'NodeBB cannot proceed with setup at this time as Redis database information ' +
				// 					'was not found. Please enter the information below.'
				// 	});

				// 	return;
				// }

				// Come back in 500ms if the config isn't ready yet
				if (nodebb_setup.config === undefined) {
					console.log('Config not ready...');
					setTimeout(function() {
						nodebb_setup.prepare();
					}, 500);
					return;
				}

				// Populate the fields on the page from the config
				var fields = document.querySelectorAll('#content [data-field]'),
					numFields = fields.length,
					x, key, inputType;
				for(x=0;x<numFields;x++) {
					key = fields[x].getAttribute('data-field');
					inputType = fields[x].getAttribute('type');
					if (nodebb_setup.config[key]) {
						switch(inputType) {
							case 'text':
							case 'textarea':
							case 'number':
								fields[x].value = nodebb_setup.config[key];
							break;

							case 'checkbox':
								fields[x].checked = nodebb_setup.config[key] ? true : false;
							break;
						}
					} else {
						// Save defaults, if they're not found in the config
						var	defaultFields = [
								'use_port', 'port', 'upload_url', 'mailer:host',
								'mailer:port', 'privileges:manage_content',
								'privileges:manage_topic'
							],
							defaultVal;
						if (defaultFields.indexOf(key) !== -1) {
							console.log('saving default value: ', key);
							switch(inputType) {
								case 'text':
								case 'textarea':
								case 'number':
									defaultVal = fields[x].value;
								break;

								case 'checkbox':
									defaultVal = fields[x].checked ? '1' : '0';
								break;
							}
							socket.emit('api:config.set', {
								key: key,
								value: defaultVal
							});
							nodebb_setup.config[key] = defaultVal;
						}
					}
				}
			}
		};

		(function() {
			// Listen for field changes and auto-save on change
			var contentEl = document.getElementById('content');

			contentEl.addEventListener('change', function(e) {
				if (e.target.hasAttribute('data-field')) {
					var key = e.target.getAttribute('data-field'),
						value;

					switch(e.target.getAttribute('type')) {
						case 'text':
						case 'textarea':
						case 'number':
							value = e.target.value;
						break;
						case 'checkbox':
							value = e.target.checked ? 1 : 0;
						break;

						default:
							return false;
						break;
					}

					socket.emit('api:config.set', { key: key, value: value });
					nodebb_setup.config[key] = value;
				}
			}, false);
			contentEl.addEventListener('click', function(e) {
				if (e.target.hasAttribute('data-path')) {
					var	href = 'install/' + e.target.getAttribute('data-path');
					if (!e.target.disabled) ajaxify.go(href);
				}
			}, false);

			socket.emit('api:config.get');
			socket.on('api:config.get', function(data) {
				nodebb_setup.config = data;
			});

			socket.on('api:config.set', function(data) {
				if (data.status === 'ok') {
					app.alert({
						alert_id: 'config_status',
						timeout: 2500,
						title: 'Configuration Saved',
						message: 'Your changes to the NodeBB configuration have been saved',
						type: 'success'
					});
				} else {
					app.alert({
						alert_id: 'config_status',
						timeout: 2500,
						title: 'Configuration Not Saved',
						message: 'NodeBB encountered a problem saving your changes',
						type: 'error'
					});
				}
			});
		})();
	</script>
</body>