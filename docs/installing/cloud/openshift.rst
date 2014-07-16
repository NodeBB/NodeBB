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

**Step 3:** SSH to the application

.. code:: bash
	
	rhc app ssh -a nodebb
	
**Step 4:** Find out your instance’s ip address NodeJS and MongoDB so NodeBB can bind to it correctly. This is one of Openshift’s demands and seems to be the only way it will work. You can’t use $IP in your config.json either (which means you can’t enter $IP in the node app –setup). First line : NodeJS and second line : MongoDB

.. code:: bash

  echo $OPENSHIFT_NODEJS_IP && echo $OPENSHIFT_MONGODB_DB_HOST
  
**Step 5:** Exit SSH

**Step 6:** Add the source code of Nodebb to the repository application

.. code:: bash
	
	cd nodebb && git remote add upstream -m master git://github.com/NodeBB/NodeBB.git

**Step 7:** Get the files and push

.. code:: bash
	
	git pull -s recursive -X theirs upstream master && git push

**Step 8:** SSH to the application

.. code:: bash
	
	rhc app ssh -a nodebb
	
**Step 9:** In other terminal, stop the application

.. code:: bash
	
	rhc app stop -a nodebb

**Step 10:** Edit the environnement NodeJS on the terminal with the SSH

.. code:: bash
	
	cd ~/nodejs/configuration && nano node.env
	
**Step 11:** Replace server.js by app.js and exit the editor

.. code:: bash
	
	ctrl + x
	
**Step 12:** In other terminal, start the application

.. code:: bash
	
	rhc app start -a nodebb

**Step 13:** Start the setup of NodeBB on the terminal with the SSH

.. code:: bash
	
	cd ~/app-root/repo && node app --setup

URL of this installation should be set to 'http://nodebb-username.rhcloud.com', replacing username with your username. 

Port number : 8080

IP or Hostname to bind to: Enter what your $OPENSHIFT_NODEJS_IP value holds here found in step 4.

Host IP or address of your MongoDB instance: Enter what your $OPENSHIFT_MONGODB_DB_HOST value holds here found in step 4. 

Host port of your MongoDB instance: 27017

MongoDB username : admin

MongoDB Admin Password: When you have added the cartridge MongoDB, the terminal give you a password, use it. If you are lost him, you will find it on the [Openshift Panel](https://openshift.redhat.com/app/console).

**Step 14:** And the last one, in other terminal, restart the application

.. code:: bash
	
	rhc app restart -a nodebb

And then open http://nodebb-username.rhcloud.com in your browser.
