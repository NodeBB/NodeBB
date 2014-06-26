
Debian
======

The current Ubuntu guide is not completely compatible with Debian and there are some specificities and especially the NodeJS installation, and how to get latest Redis.

Requirements
^^^^^^^^^^^^^^^^^^^^^^^
NodeBB requires these software to be installed:

* Node.js at least 0.10 and greater
* Redis, version 2.6 or greater
* cURL installed, just do ``sudo apt-get install curl`` in order to install it

Node.js installation
^^^^^^^^^^^^^^^^^^^^^^^

Debian 7 and Debian 6 and older doesn't have `nodejs` packages included by default, but there are some solutions to install Node.js on your Debian distribution.

Wheezy Backport :
------------------

This solution is **ONLY for Debian 7**, simply run the following **as root** :

.. code:: bash

	$ echo "deb http://ftp.us.debian.org/debian wheezy-backports main" >> /etc/apt/sources.list
	$ apt-get update


To install Node.js + NPM, run this :

.. code:: bash

	$ apt-get install nodejs-legacy
	$ curl --insecure https://www.npmjs.org/install.sh | bash


The following install a Node.js version who is greater than 0.8 (at 29 March 2014 : 0.10.21)

Compiling from the source :
------------------

This solution is for Debian 6 (Squeeze) and greater, in order to install NodeJS, run this **as root** :

.. code:: bash

	$ sudo apt-get install python g++ make checkinstall
	$ src=$(mktemp -d) && cd $src
	$ wget -N http://nodejs.org/dist/node-latest.tar.gz
	$ tar xzvf node-latest.tar.gz && cd node-v*
	$ ./configure
	$ fakeroot checkinstall -y --install=no --pkgversion $(echo $(pwd) | sed -n -re's/.+node-v(.+)$/\1/p') make -j$(($(nproc)+1)) install
	$ sudo dpkg -i node_*


Get latest Software via DotDeb
^^^^^^^^^^^^^^^^^^^^^^^

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

Debian 7 (Wheezy) :
------------------

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


Debian 6 (Squeeze)
------------------

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


Installing NodeBB
^^^^^^^^^^^^^^^^^^^^^^^

Now, we have NodeJS installed and Redis ready to be installed, run this command for install the base software stack :

.. code:: bash

	$ apt-get install redis-server imagemagick git


Next clone this repository :

.. code:: bash

	$ cd /path/to/nodebb/install/location
	$ git clone git://github.com/NodeBB/NodeBB.git nodebb

Now we are going to install all dependencies for NodeBB via NPM :

.. code:: bash

	$ cd /path/to/nodebb/install/location/nodebb (or if you are on your install location directory run : cd nodebb)
	$ npm install

Install NodeBB by running the app with `--setup` flag :

.. code:: bash

	$ ./nodebb setup


1. `URL of this installation` is either your public ip address or your domain name pointing to that ip address.  
    **Example:** ``http://0.0.0.0`` or ``http://example.org``  

2. ``Port number of your NodeBB`` is the port needed to access your site:  
    **Note:** If you do not proxy your port with something like nginx then port 80 is recommended for production.  
3. If you used the above steps to setup your redis-server then use the default redis settings.

And after all.. let's run the NodeBB forum

.. code:: bash

	$ ./nodebb start


**Note:** If you NodeBB or your server crash, your NodeBB instance will not reboot (snap), this is why you should take a look at the other way to start your NodeBB instance with helper programs such as ``supervisor`` and ``forever``, just :doc:`take a look here <../../running/index>` it's simple as a click!

Extras, tips and Advice
^^^^^^^^^^^^^^^^^^^^^^^

You should secure your NodeBB installation, `take a look here <https://github.com/NodeBB/NodeBB#securing-nodebb>`_.

You should use Nginx (or similar) in order to reverse proxy your NodeBB installation on the port 80, :doc:`take a look here <../../configuring/proxies>`
