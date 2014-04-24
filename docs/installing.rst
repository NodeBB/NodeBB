NodeBB Installation by OS
=========================

Welcome to the NodeBB wiki! We'll try to keep this wiki up-to-date regarding various aspects of NodeBB


Installing on Ubuntu
--------------------

First, we install our base software stack:

.. code:: bash

	$ apt-get install git nodejs redis-server imagemagick


If you want to use MongoDB instead of Redis install it from http://www.mongodb.org/downloads and remove 'redis-server' from the above command. [MongoDB-Setup](https://github.com/designcreateplay/NodeBB/wiki/Installing-NodeBB-With-MongoDB)

**If your package manager only installed a version of Node.js that is less than 0.8 (e.g. Ubuntu 12.10, 13.04):**


.. code:: bash

	$ add-apt-repository ppa:chris-lea/node.js
	$ apt-get update && apt-get dist-upgrade


Next, clone this repository:


.. code:: bash

	$ cd /path/to/nodebb/install/location
	$ git clone git://github.com/designcreateplay/NodeBB.git nodebb


Obtain all of the dependencies required by NodeBB:

```
$ cd nodebb
$ npm install
```

Initiate the setup script by running the app with the `--setup` flag:


.. code:: bash

	$ ./nodebb setup


The default settings are for a local server running on the default port, with a redis store on the same machine/port. 

Lastly, we run the forum.


.. code:: bash

	$ ./nodebb start


NodeBB can also be started with helper programs, such as `supervisor` and `forever`. [Take a look at the options here](https://github.com/designcreateplay/NodeBB/wiki/How-to-run-NodeBB).

Installing on SmartOS
----
## Requirements

NodeBB requires the following software to be installed:

* A version of Node.js at least 0.8 or greater.
* Redis, version 2.6 or greater (steps to install from Joyent's package repository given below).
* nginx, version 1.3.13 or greater (**only if** intending to use nginx to proxy requests to a NodeBB server).

## Server Access

1. Sign in your Joyent account: [Joyent.com](http://joyent.com)

1. Select: `Create Instance`

1. Create the newest `smartos nodejs` image.  
**Note:** The following steps have been tested with image: `smartos nodejs 13.1.0`  

1. Wait for your instance to show `Running` then click on its name.

1. Find your `Login` and admin password. If the `Credentials` section is missing, refresh the webpage.  
*Example:* `ssh root@0.0.0.0` `A#Ca{c1@3`  

1. SSH into your server as the admin not root: `ssh admin@0.0.0.0`  
**Note:** For Windows users that do not have ssh installed, here is an option: [Cygwin.com](http://cygwin.com)  

## Installation

1. Install NodeBB's software dependencies:

        $ sudo pkgin update
        $ sudo pkgin install scmgit nodejs build-essential ImageMagick redis

    If any of these failed:

        $ pkgin search *failed-name*
        $ sudo pkgin install *available-name*

2. **If needed** setup a redis-server with default settings as a service (automatically starts and restarts):  
    **Note:** These steps quickly setup a redis server but does not fine-tuned it for production.  
    **Note:** If you ran `redis-server` manually then exit out of it now.  

        $ svcadm enable redis
        $ svcs

    *-* If `svcs` shows "/pkgsrc/redis:default" in maintenance mode then:

        $ scvadm clear redis  

    *-* To shut down your redis-server and keep it from restarting:

        $ scvadm disable redis

    *-* To start up your redis-server and have it always running:

        $ scvadm enable redis

1. Move to where you want to create the nodebb folder:

        $ cd /parent/directory/of/nodebb/

1. Clone NodeBB's repository:

        $ git clone git://github.com/designcreateplay/NodeBB.git nodebb

1. Install NodeBB's npm dependencies:

        $ cd nodebb/
        $ npm install

1. Run NodeBB's setup script:  

        $ node app --setup

    1. `URL of this installation` is either your public ip address from your ssh `Login` or your domain name pointing to that ip address.  
    *Example:* `http://0.0.0.0` or `http://example.org`  
    1. `Port number of your NodeBB` is the port needed to access your site:  
    **Note:** If you do not proxy your port with something like nginx then port 80 is recommended for production.  
    1. If you used the above steps to setup your redis-server then use the default redis settings.  

1. Start NodeBB process:  

    *Run NodeBB manually:*  
    **Note:** This should not be used for production.  

        $ node app

1. Visit your app!  
    *Example:* With a port of 4567: `http://0.0.0.0:4567` or `http://example.org:4567`  
    **Note:** With port 80 the `:80` does not need to be entered.  

**Note:** If these instructions are unclear or if you run into trouble, please let us know by [filing an issue](https://github.com/designcreateplay/NodeBB/issues).

## Upgrading NodeBB

**Note:** Detailed upgrade instructions are listed in [Upgrading NodeBB](https://github.com/designcreateplay/NodeBB/wiki/Upgrading-NodeBB).


Installing on Debian
--------------------

The current Ubuntu guide is not completely compatible with Debian and there are some specificities and especially the NodeJS installation, and how to get latest Redis.

## Requirements
NodeBB requires these software to be installed :
* Node.js at least 0.10 and greater
* Redis, version 2.6 or greater
* cURL installed, just do `sudo apt-get install curl` in order to install it

## Node.js installation

Debian 7 and Debian 6 and older doesn't have `nodejs` packages included by default, but there are some solutions to install Node.js on your Debian distribution.

### Wheezy Backport :

This solution is **ONLY for Debian 7**, simply run the following **as root** :

.. code:: bash

	$ echo "deb http://ftp.us.debian.org/debian wheezy-backports main" >> /etc/apt/sources.list
	$ apt-get update


To install Node.js + NPM, run this :

.. code:: bash

	$ apt-get install nodejs-legacy
	$ curl --insecure https://www.npmjs.org/install.sh | bash


The following install a Node.js version who is greater than 0.8 (at 29 March 2014 : 0.10.21)

### Compiling from the source :

This solution is for Debian 6 (Squeeze) and greater, in order to install NodeJS, run this **as root** :

.. code:: bash

	$ sudo apt-get install python g++ make checkinstall
	$ src=$(mktemp -d) && cd $src
	$ wget -N http://nodejs.org/dist/node-latest.tar.gz
	$ tar xzvf node-latest.tar.gz && cd node-v*
	$ ./configure
	$ fakeroot checkinstall -y --install=no --pkgversion $(echo $(pwd) | sed -n -re's/.+node-v(.+)$/\1/p') make -j$(($(nproc)+1)) install
	$ sudo dpkg -i node_*


## Get latest Software via DotDeb

Dotdeb is a repository containing packages to turn your Debian boxes into powerful, stable and up-to-date LAMP servers.

* Nginx,
* PHP 5.4 and 5.3 (useful PHP extensions : APC, imagick, Pinba, xcache, Xdebug, XHpro..)
* MySQL 5.5,
* Percona toolkit,
* Redis,
* Zabbix,
* Passenger…

Dotdeb supports :

* Debian 6.0 “Squeeze“ and 7 “Wheezy“
* both amd64 and i386 architectures

### Debian 7 (Wheezy) :

For the complete DotDeb repositories :

.. code:: bash

	$ sudo echo 'deb http://packages.dotdeb.org wheezy all' >> /etc/apt/sources.list
	$ sudo echo 'deb-src http://packages.dotdeb.org wheezy all' >> /etc/apt/sources.list


After this, add the following GPC keys :

.. code:: bash

	$ wget http://www.dotdeb.org/dotdeb.gpg
	$ sudo apt-key add dotdeb.gpg


And update your package source :

.. code:: bash

	$ sudo apt-get update


### Debian 6 (Squeeze)

For the complete DotDeb repositories :

.. code:: bash

	$ sudo echo 'deb http://packages.dotdeb.org squeeze all' >> /etc/apt/sources.list
	$ sudo echo 'deb-src http://packages.dotdeb.org squeeze all' >> /etc/apt/sources.list


After this, add the following GPC keys :

.. code:: bash

	$ wget http://www.dotdeb.org/dotdeb.gpg
	$ sudo apt-key add dotdeb.gpg


And update your package source :

.. code:: bash

	$ sudo apt-get update


## Installing NodeBB

Now, we have NodeJS installed and Redis ready to be installed, run this command for install the base software stack :

.. code:: bash

	$ apt-get install redis-server imagemagick git


Next clone this repository :

.. code:: bash

	$ cd /path/to/nodebb/install/location
	$ git clone git://github.com/designcreateplay/NodeBB.git nodebb

Now we are going to install all dependencies for NodeBB via NPM :

    $ cd /path/to/nodebb/install/location/nodebb (or if you are on your install location directory run : cd nodebb)
    $ npm install

Install NodeBB by running the app with `--setup` flag :

.. code:: bash

	$ ./nodebb setup


1. `URL of this installation` is either your public ip address or your domain name pointing to that ip address.  
    *Example:* `http://0.0.0.0` or `http://example.org`  

2. `Port number of your NodeBB` is the port needed to access your site:  
    **Note:** If you do not proxy your port with something like nginx then port 80 is recommended for production.  
3. If you used the above steps to setup your redis-server then use the default redis settings.

And after all.. let's run the NodeBB forum

.. code:: bash

	$ ./nodebb start


**Note:** If you NodeBB or your server crash, your NodeBB instance will not reboot (snap), this is why you should take a look at the other way to start your NodeBB instance with helper programs such as `supervisor` and `forever`, just [take a look here](https://github.com/designcreateplay/NodeBB/wiki/How-to-run-NodeBB) it's simple as a click !

## Extras, tips and Advice

You should secure your NodeBB installation, [take a look here](https://github.com/designcreateplay/NodeBB#securing-nodebb).

You should use Nginx in order to reverse proxy your NodeBB installation on the port 80, [take a look here](https://github.com/designcreateplay/NodeBB/wiki/Configuring-nginx-as-a-proxy-to-NodeBB)

Installing on Windows 8
-----------------------
### Required Software

First, install the following programs:

* https://windows.github.com/
* http://nodejs.org/
* http://sourceforge.net/projects/redis/files/redis-2.6.10/

You may have to restart your computer.

### Running NodeBB

Start Redis Server (C:\Program Files (x86)\Redis\StartRedisServer.cmd)

Open Git Shell, and type the following commands. Clone NodeBB repo:

    git clone https://github.com/designcreateplay/NodeBB.git

Enter directory: 

    cd NodeBB

Install dependencies:

    npm install

Run interactive installation:

    node app.js

You may leave all of the options as default.

And you're done! After the installation, run 

    node app.js

You can visit your forum at http://127.0.0.1:4567/


### Developing on Windows

It's a bit of a pain to shutdown and restart NodeBB everytime you make changes. First install supervisor:

    npm install -g supervisor

Open up bash:

    bash

And run NodeBB on "watch" mode:

    ./nodebb watch

It will launch NodeBB in development mode, and watch files that change and automatically restart your forum.