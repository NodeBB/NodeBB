Image Hosting APIs
======================


Enabling Imgur Image Uploads
----------------------------

To enable post image attachments, first create an imgur app from :

https://api.imgur.com/oauth2/addclient

You can use : "Anonymous usage without user authorization"

After that you will get a "Client ID". 

Then install nodebb-plugin-imgur:

.. code::
	
	npm install nodebb-plugin-imgur

Activate the plugin from the control panel and restart NodeBB.

You should see a Imgur menu item in the control panel. Paste the Client ID to the "Imgur Client ID" in the plugin page. Save and you should be able to upload images by dragging them into the composer window.



Uploading to Amazon S3
-----------------------

.. note:: 

	No documentation for this yet! See `the plugin thread <https://community.nodebb.org/topic/796/nodebb-plugin-s3-uploads-store-your-uploads-in-aws-s3>`_ for more information.