Need Help?
==========


Frequently Asked Questions
--------------------------

If you experience difficulties setting up a NodeBB instance, perhaps one of the following may help.

Is it possible to install NodeBB via FTP?
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

It is possible to transfer the files to your remote server using FTP, but you do require shell access to the server in order to actually "start" NodeBB. Here is `a handy guide for installing NodeBB on DigitalOcean <http://burnaftercompiling.com/nodebb/setting-up-a-nodebb-forum-for-dummies/>`_

I'm getting an "npm ERR!" error
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

For the most part, errors involving ``npm`` are due to Node.js being outdated. If you see an error similar to this one while running ``npm install``:

.. code:: bash

    npm ERR! Unsupported
    npm ERR! Not compatible with your version of node/npm: connect@2.7.11

You'll need to update your Node.js version to 0.8 or higher.

To do this on Ubuntu:

.. code:: bash

    # add-apt-repository ppa:chris-lea/node.js
    # apt-get update && apt-get dist-upgrade -y
    # apt-cache policy nodejs    // should show a version higher than 0.8

I upgraded NodeBB and now X isn't working properly!
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Please consult [[Upgrading NodeBB]]


Submit Bugs on our Issue Tracker
--------------------------------

Before reporting bugs, please ensure that the issue has not already been filed on our `tracker <https://github.com/designcreateplay/NodeBB/issues?state=closed>`_, or has already been resolved on our `support forum <http://community.nodebb.org/category/6/bug-reports>`_. If it has not been filed, feel free to create an account on GitHub and `create a new issue <https://github.com/designcreateplay/NodeBB/issues>`_.


Ask the NodeBB Community
------------------------

Having trouble installing NodeBB? Or did something break? Don't hesitate to `join our forum <community.nodebb.org/register>`_ and ask for help. Hopefully one day you'll be able to help others too :) 