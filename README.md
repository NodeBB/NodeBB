# NodeBB
**NodeBB** is a robust nodejs driven forum built on a redis database. It is powered by web sockets, and is compatible down to IE8.

![NodeBB Screenshot](http://i.imgur.com/mxRmLAg.png)

![NodeBB Login Page (with Social Logins)](http://i.imgur.com/q5tUUHW.png)

## Requirements

NodeBB requires a version of Node.js at least 0.8 or greater, and a Redis version 2.6 or greater.

## Installation

First, we install our base software stack. `build-essential` is required as it exposes the build environment for `bcrypt` compilation, we won't be compiling anything manually.

	# apt-get install git nodejs redis-server npm build-essential
	$ cd /path/to/nodebb/install/location
	$ git clone git://github.com/designcreateplay/NodeBB.git nodebb

Next, obtain all of the dependencies required by NodeBB:

    $ cd nodebb
    $ npm install

Now we ensure that the configuration files are properly set up. NodeBB runs on port 4567 by default. The client side config can be set up thusly:

    $ cp public/config.default.json public/config.json

... and the server side config can be set up similarly:

    $ cp config.default.js config.js

Ensure that `/public/config.json` points to the publically accessible IP/hostname of your forum, and that the values of the server side config are also set correctly (see below).

Lastly, we run the forum.

    $ node app

*(Optional)* Some server configurations may install the node binary as `nodejs` instead of `node`. You can re-map it (so as to not break compatibility with `node-supervisor`) by running the following command:

    # update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

## Server Configuration

The server configuration file (located at `/config.js`) contains default options required for the running of NodeBB. The following options are available:

<table>
	<tr>
		<th>Option</th>
		<th>Description</th>
	</tr>
	<tr>
		<td><b>base_url</b></td>
		<td><i>(Default: 'http://localhost')</i> A web-accessible URL to your app, without the port</td>
	</tr>
	<tr>
		<td><b>upload_path</b></td>
		<td><i>(Default: '/public/uploads')</i> A relative path (relative to the application's web root) to the uploads folder. Please ensure that Node.js can write to this folder</td>
	</tr>
	<tr>
		<td><b>use_port</b></td>
		<td><i>(Default: true)</i> Whether or not to include the port number when constructing the url for use in NodeBB. If you are serving NodeBB via a proxy (i.e. nginx), switch this off.
	<tr>
		<td><b>port</b></td>
		<td><i>(Default: 4567)</i> The default port that NodeBB runs on. Even if you are running NodeBB behind a proxy server, this port must be set.</td>
	</tr>
	<tr>
		<td><b>mailer</b></td>
		<td>
			<i>(Default: {<br />
				&nbsp;&nbsp;&nbsp;&nbsp;host: 'localhost',<br />
				&nbsp;&nbsp;&nbsp;&nbsp;port: '25',<br />
				&nbsp;&nbsp;&nbsp;&nbsp;from: 'mailer@localhost.lan'<br />
			})</i><br />
			Settings for the outgoing mailer (for emails involving user registration/password resets)
		</td>
	</tr>
</table>

## Client Configuration

As the client will utilise web sockets to connect to the server, you'll need to customise the client configuration file (located at `/public/config.json`) to point to your server's publically accessible IP. The port will be identical to the port specified in the server-side configuration (defaulted to `4567`).