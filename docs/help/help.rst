Need Help?
==========


Frequently Asked Questions
--------------------------

If you experience difficulties setting up a NodeBB instance, perhaps one of the following may help.

How do I start/stop/restart NodeBB?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

You can call the ``./nodebb`` executable to start and stop NodeBB:

.. code:: bash

    $ ./nodebb
	Welcome to NodeBB
	Usage: ./nodebb {start|stop|reload|restart|log|setup|reset|upgrade|dev|watch}

	start    Start the NodeBB server
	stop     Stops the NodeBB server
	reload   Restarts NodeBB
	restart  Restarts NodeBB
	log      Opens the logging interface (useful for debugging)
	setup    Runs the NodeBB setup script
	reset    Disables all plugins, restores the default theme.
	upgrade  Run NodeBB upgrade scripts, ensure packages are up-to-date
	dev      Start NodeBB in interactive development mode
	watch    Start NodeBB in development mode and watch for changes

How do I upgrade my NodeBB?
^^^^^^^^^^^^^^^^^^^^^^^^^^^

Please consult :doc:`Upgrading NodeBB <../upgrading/index>`

I upgraded NodeBB and now X isn't working properly!
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Please consult :doc:`Upgrading NodeBB <../upgrading/index>`

I installed an incompatible plugin, and now my forum won't start!
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

If you know which plugin caused problems, disable it by running: ``./nodebb reset plugin="nodebb-plugin-pluginName"``

Otherwise, disable all plugins by running: ``./nodebb reset plugins``

Is it possible to install NodeBB via FTP?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

It is possible to transfer the files to your remote server using FTP, but you do require shell access to the server in order to actually "start" NodeBB. Here is `a handy guide for installing NodeBB on DigitalOcean <http://burnaftercompiling.com/nodebb/setting-up-a-nodebb-forum-for-dummies/>`_

I'm getting an "npm ERR!" error
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

For the most part, errors involving ``npm`` are due to Node.js being outdated. If you see an error similar to this one while running ``npm install``:

.. code:: bash

    npm ERR! Unsupported
    npm ERR! Not compatible with your version of node/npm: connect@2.7.11

You'll need to update your Node.js version to 0.8 or higher.

To do this on Ubuntu:

.. code:: bash

    # add-apt-repository ppa:chris-lea/node.js
    # apt-get update && apt-get dist-upgrade -y

If successful, running the following command should show a version higher than 0.8

.. code:: bash

    # apt-cache policy nodejs

URLs on my NodeBB (or emails) still have the port number in them!
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

If you are using :doc:`nginx <../configuring/proxies/nginx>` or :doc:`Apache <../configuring/proxies/apache>` as a reverse proxy, you don't need the port to be shown. Simply run `./nodebb setup` and specify the base URL without a port number.

Alternatively, edit the ``config.json`` file using your favourite text editor and change ``use_port`` to ``false``.


The "Recently Logged In IPs" section only shows 127.0.0.1
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

NodeBBs running behind a proxy may have difficulties determining the original IP address that requests come from. It is important that the proxy server provides the referral IP header.

In nginx, ensure that the following line is present in your ``server`` block:

.. code:: nginx

    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

In addition, ensure that the ``use_port`` option is set to ``false`` in your NodeBB's ``config.json``


Submit Bugs on our Issue Tracker
--------------------------------

Before reporting bugs, please ensure that the issue has not already been filed on our `tracker <https://github.com/NodeBB/NodeBB/issues?state=closed>`_, or has already been resolved on our `support forum <http://community.nodebb.org/category/6/bug-reports>`_. If it has not been filed, feel free to create an account on GitHub and `create a new issue <https://github.com/NodeBB/NodeBB/issues>`_.


Ask the NodeBB Community
------------------------

Having trouble installing NodeBB? Or did something break? Don't hesitate to `join our forum <community.nodebb.org/register>`_ and ask for help. Hopefully one day you'll be able to help others too :)