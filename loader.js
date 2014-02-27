var	fork = require('child_process').fork,
	start = function() {
		nbb = fork('./app', process.argv.slice(2), {
				env: {
					'NODE_ENV': process.env.NODE_ENV
				}
			});

		nbb.on('message', function(cmd) {
			if (cmd === 'nodebb:restart') {
				nbb.on('exit', function() {
					start();
				});
				nbb.kill();
			}
		});
	},
	stop = function() {
		nbb.kill();
	},
	nbb;

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

start();