MongoDB
=======

If you're afraid of running out of memory by using Redis, or want your forum to be more easily scalable, you can install NodeBB with MongoDB. This tutorial assumes you know how to SSH into your server and have root access.

**These instructions are for Ubuntu. Adjust them accordingly for your distro.**

**Note:** If you have to add ``sudo`` to any command, do so. No one is going to hold it against you ;)

Step 1: Install MongoDB
-------------------------

The latest and greatest MongoDB is required (or at least greater than the package manager). The instructions to install it can be found on the `MongoDB manual <http://docs.mongodb.org/manual/administration/install-on-linux/>`_).

Step 2: Install node.js
-------------------------

Like MongoDB, the latest and greatest node.js is required (or at least greater than the package manager), so I'm leaving this to the official wiki. The instructions to install can be found on `Joyent <https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager>`_.

**Note: NPM is installed along with node.js, so there is no need to install it separately**

Step 3: Install the Base Software Stack
-------------------------

Enter the following into the terminal to install the base software required to run NodeBB:

.. code:: bash

    # apt-get install git build-essential imagemagick

Step 4: Clone the Repository
-------------------------

Enter the following into the terminal, replacing `/path/to/nodebb/install/location` to where you would like NodeBB to be installed.

.. code:: bash

    $ cd /path/to/nodebb/install/location
    $ git clone git://github.com/NodeBB/NodeBB.git nodebb

Step 5: Install The Required NodeBB Dependencies
-------------------------

Go into the newly created `nodebb` directory and install the required dependencies by entering the following.

.. code:: bash

    $ cd nodebb
    $ npm install

Step 6: Adding a New Database With Users
-------------------------

To go into the MongoDB command line, type:

.. code:: bash

    $ mongo

To add a new database called `nodebb`, type:

.. code::

    > use nodebb

To add a user to access the `nodebb` database, type:

.. code::

    > db.addUser( { user: "nodebb",
    ...       pwd: "<Enter in a secure password>",
    ...       roles: [ "userAdmin" ] } )

**Note:** The role ``userAdmin`` gives all permissions to the user for that specific database.

Step 7: Configure MongoDB
-------------------------

MongoDB needs text search enabled. Modify ``/etc/mongodb.conf``.

.. code::

    # nano /etc/mongodb.conf

Add ``setParameter=textSearchEnabled=true`` to the end. Also, to enable authentication, uncomment ``auth = true``. Restart MongoDB.

.. code::

    # service mongodb restart

Step 8: Configuring NodeBB
-------------------------

Make sure you are in your NodeBB root folder. If not, just type:

.. code::

    $ cd /path/to/nodebb

To setup the app, type:

.. code::

    $ node app --setup

* Change the hostname to your domain name.  
* Accept the defaults by pressing enter until it asks you what database you want to use. Type ``mongo`` in that field.
* Accept the default port, unless you changed it in the previous steps.
* Change your username to ``nodebb``, unless you set it to another username.
* Enter in the password you made in step 5.
* Change the database to ``nodebb``, unless you named it something else.

Continue with the installation, following the instructions the installer provides you.

Step 9: Starting the App
-------------------------

To start the app, run:

.. code::

    $ node app

Now visit ``yourdomainorip.com:4567`` and your NodeBB installation should be running.

NodeBB can also be started with helper programs, such as :doc:`supervisor or forever <../../running/index>`. You can also use ``nginx`` as a :doc:`reverse proxy <../../configuring/proxies>`).