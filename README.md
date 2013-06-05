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