Openshift Paas
===========

The following are installation instructions for the `Openshift <http://openshift.com>` Paas.

**Step 1:** Create a new application :

.. code:: bash
	
	rhc app create nodebb nodejs-0.10

The nodebb command after the git url will create a file called nodebb so you have to CD into the file after you have cloned NodeBB.

**Step 2:** Add cartridge MongoDB

.. code:: bash
	
	rhc cartridge add mongodb-2.4 -a nodebb

**Step 2:** SSH to the application

.. code:: bash
	
	rhc app ssh -a nodebb
	
**Step 8:** Find out your instance’s ip address NodeJS and MongoDB so NodeBB can bind to it correctly. This is one of Openshift’s demands and seems to be the only way it will work. You can’t use $IP in your config.json either (which means you can’t enter $IP in the node app –setup). First line : NodeJS and second line : MongoDB

.. code:: bash

  echo $OPENSHIFT_NODEJS_IP && echo $OPENSHIFT_MONGODB_DB_HOST
  
**Step 3:** Exit SSH

**Step 3:** Add the source code of Nodebb to the repository application

.. code:: bash
	
	cd nodebb && git remote add upstream -m master git://github.com/NodeBB/NodeBB.git

**Step 4:** Get the files and push

.. code:: bash
	
	git pull -s recursive -X theirs upstream master && git push

**Step 5:** SSH to the application

.. code:: bash
	
	rhc app ssh -a nodebb

**Step 6:** Edit the environnement NodeJS

.. code:: bash
	
	cd nodejs/configuration && nano node.env
	
**Step 7:** Replace server.js by app.js and exit the editor

.. code:: bash
	
	ctrl + x

**Step 9:** Start the setup of NodeBB

.. code:: bash
	
	cd ~/app-root/repo && node app --setup

URL of this installation should be set to 'http://nodebb-username.rhcloud.com', replacing username with your username. 

Port number : 8080

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
