# node-forum
**node-forum** is a robust nodejs driven forum built on a redis database.

## Installation

First step is to obtain all of the dependencies requires by node-forum:

    $ npm install

Next, we install redis. If you have redis installed, you can skip this step.

    # apt-get install redis

Lastly, we run the forum.

    $ node app

## Config

node-forum is pre-configured to run on port 4567, with default options defined in config.json. The following options are available:

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