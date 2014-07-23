Windows 8
==========

Required Software
---------------------

First, install the following programs:

* https://windows.github.com/
* http://nodejs.org/
* http://sourceforge.net/projects/redis/files/redis-2.6.10/
* http://imagemagick.org/script/binary-releases.php#windows/

You may have to restart your computer.

Running NodeBB
---------------------

Start Redis Server

.. note::

	The default location of Redis Server is

	**C:\\Program Files (x86)\\Redis\\StartRedisServer.cmd**

Open Git Shell, and type the following commands. Clone NodeBB repo:

.. code:: bash

    git clone https://github.com/NodeBB/NodeBB.git

Enter directory: 

.. code:: bash

    cd NodeBB

Install dependencies:

.. code:: bash

    npm install

Run interactive installation:

.. code:: bash

    node app.js

You may leave all of the options as default.

And you're done! After the installation, run 

.. code:: bash

    node app.js

You can visit your forum at ``http://127.0.0.1:4567/``


Developing on Windows
---------------------

It's a bit of a pain to shutdown and restart NodeBB everytime you make changes. First install supervisor:

.. code:: bash

    npm install -g supervisor

Open up bash:

.. code:: bash

    bash

And run NodeBB on "watch" mode:

.. code:: bash

    ./nodebb watch

It will launch NodeBB in development mode, and watch files that change and automatically restart your forum.
