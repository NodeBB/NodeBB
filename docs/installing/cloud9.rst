Cloud 9 IDE
===========

The following are installation instructions for the `Cloud 9 <https://c9.io/>`_ web based IDE.

**Step 1:** Clone NodeBB into a new workspace from GitHub. You can use the following command from the terminal:

.. code:: bash
	
	git clone git://github.com/NodeBB/NodeBB.git nodebb

The nodebb command after the git url will create a file called nodebb so you have to CD into the file after you have cloned NodeBB.

**Step 2:** Install redis with Cloud9's package manager

.. code:: bash
	
	nada-nix install redis

**Step 3:** Run your redis server on port 16379 - port 6379 tends to be already used on Cloud 9. The "&" makes the command run in the background. You can always terminate the process later. $IP is a Cloud 9 system variable containing the global ip of your server instance.

.. code:: bash
	
	redis-server --port 16379 --bind $IP &

**Step 4:** Find out your instance's ip address so NodeBB can bind to it correctly. This is one of Cloud 9's demands and seems to be the only way it will work. You can't use $IP in your config.json either (which means you can't enter $IP in the node app --setup).

.. code:: bash
	
	echo $IP

**Step 5:** Install NodeBB and it's dependencies:

.. code:: bash
	
	npm install

**Step 6:** Run the nodebb setup utility:

.. code:: bash
	
	node app --setup

URL of this installation should be set to 'http://workspace_name-c9-username.c9.io', replacing workspace_name with your workspace name and username with your username. Note that as NodeBB is currently using unsecure http for loading jQuery you will find it much easier using http:// instead of https:// for your base url. Otherwise jQuery won't load and NodeBB will break.

Port number isn't so important - Cloud9 may force you to use port 80 anyway. Just set it to 80. If this is another port, like 4567, that is also fine.

Use a port number to access NodeBB? Again, this doesn't seem to make a big difference. Set this to no. Either will work.

Host IP or address of your Redis instance: localhost (the output of the $IP Command is also acceptable)

IP or Hostname to bind to: Enter what your $IP value holds here found in step 4. It should look something like: 123.4.567.8

Host port of your Redis instance: 16379

Redis Password: Unless you have set one manually, Redis will be configured without a password. Leave this blank and press enter

First-time set-up will also require an Admin name, email address and password to be set.

And you're good to go! Don't use the Run button at the top if the IDE, it has been a little buggy for me. Besides, you're better off using the command line anyway. Run:

.. code:: bash
	
	node app

And then open http://workspace_name-c9-username.c9.io in your browser.

Troubleshooting
---------------

A common problem is that the database hasn't been started. Make sure you have set Redis up correctly and ran 

.. code:: bash
	
	redis-server --port 16379 --bind $IP