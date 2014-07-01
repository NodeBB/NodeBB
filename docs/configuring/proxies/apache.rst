Configuring apache as a proxy
=============================

**Prerequisites to making this work:**
Apache 2.4.x

What if I'm on 2.2.x (Debian/Ubuntu)?
------------------------------------

you need to manually compile and add the module "mod_proxy_wstunnel" to the Apache 2.2 branch. If you're running Ubuntu or Debian, you're likely on the 2.2 branch of code.

The following guide will assist with that if you're on Debian or Ubuntu. This is what I used to backport the mod_proxy_wstunnel module to the 2.2 code base of Apache;

http://www.amoss.me.uk/2013/06/apache-2-2-websocket-proxying-ubuntu-mod_proxy_wstunnel/

NOTE: On ubuntu, if you’re missing the ./configure file
------------------------------------
You need to first run ./buildconf. After this is complete, you will then be able to use ./configure.

**automake & libtool package was needed too.**

.. code::

    apt-get install automake libtool


Enable the necessary modules
-----------------------------

1. sudo a2enmod proxy
2. sudo a2enmod proxy_http
3. sudo a2enmod proxy_wstunnel

Add the config to Apache
-----------------------------

The next step is adding the configuration to your virtualhost.conf file, typically located in /etc/apache2/sites-available/. The below configuration assumes you've used 4567 (default) port for NobeBB installation. It also assumes you have the bind address set to 127.0.0.1.

.. code::

    ProxyRequests off

    <Proxy *>
        Order deny,allow
        Allow from all
    </Proxy>
    ProxyPass /socket.io/1/websocket ws://127.0.0.1:4567/socket.io/1/websocket
    ProxyPassReverse /socket.io/1/websocket ws://127.0.0.1:4567/socket.io/1/websocket

    ProxyPass /socket.io/ http://127.0.0.1:4567/socket.io/
    ProxyPassReverse /socket.io/ http://127.0.0.1:4567/socket.io/

    ProxyPass / http://127.0.0.1:4567/
    ProxyPassReverse / http://127.0.0.1:4567/


The last thing you need to be sure of is that the config.json in the NodeBB folder has use_port: false. Otherwise some functionality will not work properly.


Example nodebb/config.json
-----------------------------

.. code:: json

    {
        "base_url": "http://www.yoursite.com",
        "port": "4567",
        "use_port": false,
        "secret": "55sb254c-62e3-4e23-9407-8655147562763",
        "bind_address": "127.0.0.1",
        "database": "redis",
        "redis": {
            "host": "127.0.0.1",
            "port": "6379",
            "password": "",
            "database": "0"
        },
        "bcrypt_rounds": 12,
        "upload_path": "/public/uploads",
        "relative_path": ""
    }


**Change the domain and dont use the secret in the example above.**
