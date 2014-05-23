Heroku
======

**Note**: Installations to Heroku require a local machine with some flavour of unix, as NodeBB does not run on Windows.

1. Download and install `Heroku Toolbelt <https://toolbelt.heroku.com/>`_ for your operating system
2. Log into your Heroku account: ``heroku login``
3. Verify your Heroku account by adding a credit card (at http://heroku.com/verify)
4. Clone the repository: ``git clone https://github.com/NodeBB/NodeBB.git /path/to/repo/clone``
5. ``cd /path/to/repo/clone``
6. Install dependencies locally ``npm install``
7. Create the heroku app: ``heroku create``
8. Enable WebSocket support (beta): ``heroku labs:enable websockets -a {APP_NAME}``, where ``{APP_NAME}`` is provided by Heroku, and looks something like ``adjective-noun-wxyz.herokuapp.com`` (NOTE: `See this doc <https://discussion.heroku.com/t/application-error/160>`_): drop the `.herokuapp.com` when entering ``{APP_NAME}`` above. 
9. Enable `Redis To Go <https://addons.heroku.com/redistogo>`_ for your heroku account: ``heroku addons:add redistogo:nano``
10. Run the NodeBB setup script: ``node app --setup`` (information for your Heroku server and Redis to Go instance can be found in your account page)
    * Your server name is found in your Heroku app's "settings" page, and looks something like ``adjective-noun-wxyz.herokuapp.com``
    * Use any port number. It will be ignored.
    * Specify "n" when asked if a port will be used. Heroku transparently proxies all requests.
    * Your redis server can be found as part of the redis url. For example, for the url: ``redis://redistogo:h28h3wgh37fns7@crestfish.redistogo.com:12345/``
    * The server is ``fishyfish.redistogo.com``
    * The port is ``12345``
    * The password is ``h28h3wgh37fns7``
11. Create a Procfile for Heroku: ``echo "web: node app.js" > Procfile``
12. Commit the Procfile:

.. code:: bash

	git add -f Procfile config.json public/config.json && git commit -am "adding Procfile and configs for Heroku"

13. Push to heroku: ``git push heroku master``
    * Ensure that a proper SSH key was added to your account, otherwise the push will not succeed!
14. Initialise a single dyno: ``heroku ps:scale web=1``
15. Visit your app!

If these instructions are unclear or if you run into trouble, please let us know by `filing an issue <https://github.com/NodeBB/NodeBB/issues>`_.

Keeping it up to date
---------------------

If you wish to pull the latest changes from the git repository to your Heroku app:

1. Navigate to your repository at ``/path/to/nodebb``
2. ``git pull``
3. ``npm install``
4. ``node app --upgrade``
5. ``git commit -am "upgrading to latest nodebb"``
6. ``git push heroku master``