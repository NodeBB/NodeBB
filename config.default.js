var config = {
	// The "secret" is used to encrypt cookie sessions, change this to any random string
	"secret": 'nodebb-secret',

	// "base_url" is expected to be a publically accessible URL to your NodeBB instance (Default base_url: 'http://localhost', port: '4567')
	"base_url": "http://localhost",
	
	// relative path for uploads
	"upload_path": "/uploads/",
	
	"use_port": true,
	"port": 4567,

	// The host and port to the SMTP server used by NodeBB. The "from" value must be changed.
	"mailer": {
		host: 'localhost',
		port: '25',
		from: 'mailer@localhost.lan'
	},

	// Connection details to the redis database instance.
	"redis": {
		port: "6379",
		host: "127.0.0.1",
		options: {
			
		}
	},

	// Social Networking integration. Add the appropriate API keys to activate
	// login via alternate method, otherwise the option will not be presented
	// to the user
	"twitter": {
		"key": '',
		"secret": ''
	},
	"google": {
		"id": '',
		"secret": ''
	},
	"facebook": {
		"app_id": '',
		"secret": ''
	},

	// Privileged Actions Reputation Thresholds
	"privilege_thresholds": {
		"manage_thread": 1000,
		"manage_content": 2000
	}
}

config.url = config.base_url + (config.use_port ? ':' + config.port : '') + '/';
config.upload_url = config.base_url + (config.use_port ? ':' + config.port : '') + '/uploads/';

module.exports = config;