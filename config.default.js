var config = {
	"base_url": "http://localhost",
	"port": 4567,
	"url": undefined,	// Leave this alone
	"mailer": {
		host: 'localhost',
		port: '25',
		from: 'mailer@localhost.lan'
	}
}

config.url = config.base_url + ':' + config.port + '/';

module.exports = config;