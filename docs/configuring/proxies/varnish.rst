Configuring Varnish Cache
==========================

To be sure Varnish will work properly with NodeBB check that your configuration ``/etc/varnish/default.vcl`` is optimized for **websockets**.

.. code:: 

  backend nodebb {
    .host = "127.0.0.1"; # your nodebb host
    .port = "4567"; # your nodebb port
  }

  sub vcl_recv {

    # Pipe websocket connections directly to Node.js
    if (req.http.Upgrade ~ "(?i)websocket") {
      set req.backend = nodebb;
      return (pipe);
    }

    # NodeBB
    if (req.http.host == "forum.yourwebsite.com") { # change this to match your host
      if (req.url ~ "^/socket.io/") {
          set req.backend = nodebb;
          return (pipe); # return pass seems not working for websockets
      }
      return (pass); # don't cache
    }

  }

  sub vcl_pipe {
    # Need to copy the upgrade header
    if (req.http.upgrade) {
      set bereq.http.upgrade = req.http.upgrade;
    }
  }