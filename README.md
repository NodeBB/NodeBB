[NodeBB Homepage](http://www.nodebb.org/ "NodeBB")

Please support us! [Check out our IndieGoGo campaign](http://https://www.indiegogo.com/projects/nodebb-the-discussion-platform-of-the-future/ "IndieGoGo")

[Follow our development on Twitter](http://www.twitter.com/NodeBB/ "NodeBB Twitter")

[Like us on Facebook](http://www.facebook.com/NodeBB/ "NodeBB Facebook")


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

Initiate the setup script by running the app with the `--setup` flag:

    $ node app --setup

The default settings are for a local server running on the default port, with a redis store on the same machine/port.

Lastly, we run the forum.

    $ node app

*(Optional)* Some server configurations may install the node binary as `nodejs` instead of `node`. You can re-map it (so as to not break compatibility with `node-supervisor`) by running the following command:

    # update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10