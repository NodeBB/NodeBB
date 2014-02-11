# NodeBB
**NodeBB** is a robust Node.js driven forum built on a Redis database. It is powered by web sockets, and is compatible down to IE8.

* [NodeBB Homepage](http://www.nodebb.org/ "NodeBB")
* [Demo & Meta Discussion](http://community.nodebb.org)
* [NodeBB Blog](http://blog.nodebb.org)
* [Wiki Guides](https://github.com/designcreateplay/NodeBB/wiki) - includes setup for other platforms
* [Join us on IRC](https://kiwiirc.com/client/irc.freenode.net/nodebb) - #nodebb on Freenode
* [Follow on Twitter](http://www.twitter.com/NodeBB/ "NodeBB Twitter")
* [Like us on Facebook](http://www.facebook.com/NodeBB/ "NodeBB Facebook")
* [Get Plugins](http://community.nodebb.org/category/7/nodebb-plugins "NodeBB Plugins")
* [Get Themes](http://community.nodebb.org/category/10/nodebb-themes "NodeBB Themes")


## How can I follow along/contribute?

* Our feature roadmap is hosted on the project wiki's [Version History / Roadmap](https://github.com/designcreateplay/NodeBB/wiki/Version-History-%26-Roadmap)
* If you are a developer, feel free to check out the source and submit pull requests. We also have a wide array of [plugins](http://community.nodebb.org/category/7/nodebb-plugins) which would be a great starting point for learning the codebase.
* If you are a designer, [NodeBB needs themes](http://community.nodebb.org/category/10/nodebb-themes)! NodeBB's theming system allows extention of the base templates as well as styling via LESS or CSS. NodeBB's base theme utilizes [Bootstrap 3](http://getbootstrap.com/) but themes can choose to use a different framework altogether.
* Please don't forget to like, follow, and star our repo! Join our growing [community](http://community.nodebb.org) to keep up to date with the latest NodeBB development.


## Screenshots 

[<img src="http://i.imgur.com/FLOUuIqb.png" />](http://i.imgur.com/FLOUuIq.png)&nbsp;[<img src="http://i.imgur.com/Ud1LrfIb.png" />](http://i.imgur.com/Ud1LrfI.png)&nbsp;[<img src="http://i.imgur.com/ZC8W39ab.png" />](http://i.imgur.com/ZC8W39a.png)&nbsp;[<img src="http://i.imgur.com/o90kVPib.png" />](http://i.imgur.com/o90kVPi.png)&nbsp;[<img src="http://i.imgur.com/AaRRrU2b.png" />](http://i.imgur.com/AaRRrU2.png)

Credit: [Convoe](http://www.convoe.com), [Kano](http://www.kano.me).

## Requirements

NodeBB requires the following software to be installed:

* A version of Node.js at least 0.8 or greater
* Redis, version 2.6 or greater **or** MongoDB, version 2.4 or greater
* nginx, version 1.3.13 or greater (**only if** intending to use nginx to proxy requests to a NodeBB)

## Installation

First, we install our base software stack:

	# apt-get install git nodejs redis-server build-essential imagemagick

If you want to use MongoDB instead of Redis install it from http://www.mongodb.org/downloads and remove 'redis-server' from the above command. [MongoDB-Setup](https://github.com/designcreateplay/NodeBB/wiki/Installing-NodeBB-With-MongoDB)

**If your package manager only installed a version of Node.js that is less than 0.8 (e.g. Ubuntu 12.10, 13.04):**

	# add-apt-repository ppa:chris-lea/node.js
	# apt-get update && apt-get dist-upgrade

Next, clone this repository:

	$ cd /path/to/nodebb/install/location
	$ git clone git://github.com/designcreateplay/NodeBB.git nodebb

Obtain all of the dependencies required by NodeBB:

    $ cd nodebb
    $ npm install

Initiate the setup script by running the app with the `--setup` flag:

    $ node app --setup

The default settings are for a local server running on the default port, with a redis store on the same machine/port.

Lastly, we run the forum.

    $ node app

NodeBB can also be started with helper programs, such as `supervisor` and `forever`. [Take a look at the options here](https://github.com/designcreateplay/NodeBB/wiki/How-to-run-NodeBB).

*(Optional)* Some server configurations may install the node binary as `nodejs` instead of `node`. You can re-map it (so as to not break compatibility with `node-supervisor`) by running the following command:

    # update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

## Upgrading NodeBB

Detailed upgrade instructions are listed in [Upgrading NodeBB](https://github.com/designcreateplay/NodeBB/wiki/Upgrading-NodeBB)
