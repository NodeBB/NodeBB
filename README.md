# node-forum
**node-forum** is a robust nodejs driven forum built on a redis database. It is powered by web sockets, and is compatible down to IE8.

## Installation

First step is to obtain all of the dependencies requires by node-forum:

    $ npm install

*(Optional)* Next, we install redis. If you already have redis installed, you can skip this step.

    # apt-get install redis

Lastly, we run the forum.

    $ node app

## Server Configuration

The server configuration file (located at `/config.js`) contains default options required for the running of node-forum. The following options are available:

<table>
	<tr>
		<th>Option</th>
		<th>Description</th>
	</tr>
	<tr>
		<td><b>port</b></td>
		<td><i>(Default: 4567)</i> The default port that node-forum runs on</td>
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