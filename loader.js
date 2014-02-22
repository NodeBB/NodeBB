var	fork = require('child_process').fork,
	start = function() {
		var	nbb = fork('./app', process.argv.slice(2), {
				env: {
					'NODE_ENV': process.env.NODE_ENV
				}
			});

		nbb.on('message', function(cmd) {
			if (cmd === 'nodebb:restart') {
				if (process.env.NODE_ENV !== 'development') {
					nbb.on('exit', function() {
						start();
					});
					nbb.kill();
				} else {
					console.log('[app] Development Mode is on, restart aborted.');
				}
			}
		});
	}

start();