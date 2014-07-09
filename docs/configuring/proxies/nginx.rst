Configuring nginx as a proxy
============================

NodeBB by default runs on port ``4567``, meaning that builds are usually accessed using a port number in addition to their hostname:

.. code::

    http://example.org:4567

In order to allow NodeBB to be served without a port, nginx can be set up to proxy all requests to a particular hostname (or subdomain) to an upstream NodeBB build running on any port.

Requirements
------------

* NGINX version v1.3.13 or greater
    * Package managers may not provide a new enough version. To get the latest version, `compile it yourself <http://nginx.org/en/download.html>`_, or if on Ubuntu, use the `NGINX Stable <https://launchpad.net/~nginx/+archive/stable>`_ or `NGINX Development <https://launchpad.net/~nginx/+archive/development>`_ PPA builds, if you are on Debian, use `DotDeb repository <http://www.dotdeb.org/instructions/>`_ to get the latest version of Nginx.
    * To determine your nginx version, execute ``nginx -V`` in a shell

Configuration
------------

NGINX-served sites are contained in a ``server`` block. This block of options goes in a specific place based on how nginx was installed and configured:

* ``/path/to/nginx/sites-available/*`` -- files here must be aliased to ``../sites-enabled``
* ``/path/to/nginx/conf.d/*.conf`` -- filenames must end in ``.conf``
* ``/path/to/nginx/httpd.conf`` -- if all else fails

Below is the basic nginx configuration for a NodeBB build running on port ``4567``:

.. code:: nginx

    server {
        listen 80;

        server_name forum.example.org;

        location / {
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Host $http_host;
            proxy_set_header X-NginX-Proxy true;

            proxy_pass http://127.0.0.1:4567/;
            proxy_redirect off;

            # Socket.IO Support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }


Notes
------------

* Remember to also edit `config.json` and change `use_port` from `true` to `false`
* nginx must be on version 1.4.x to properly support websockets. Debian/Ubuntu use 1.2, although it will work there will be a reduction in functionality.
* The ``proxy_pass`` IP should be ``127.0.0.1`` if your NodeBB is hosted on the same physical server as your nginx server. Update the port to match your NodeBB, if necessary.
* This config sets up your nginx server to listen to requests for ``forum.example.org``. It doesn't magically route the internet to it, though, so you also have to update your DNS server to send requests for ``forum.example.org`` to the machine with nginx on it!