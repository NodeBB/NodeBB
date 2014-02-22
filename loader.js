var	fork = require('child_process').fork,
	start = function() {
		var	nbb = fork('./app', [], {
				env: {
					'NODE_ENV': 'development'
				}
			});

		nbb.on('message', function(cmd) {
			if (cmd === 'nodebb:restart') {
				nbb.kill();
				setTimeout(function() {
					start();
				}, 1000);
			}
		});
	};

start();