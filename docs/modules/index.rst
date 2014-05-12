Core Modules
================

.. note::

    This section is under construction. Have a look at the modules folder for more information, located at:

    .. code:: bash

    	public/src/modules

Alerts
-------

The alert module is a toaster notification that can be called via the following syntax:

.. code:: javascript

	app.alert({
	    title: 'Success!',
	    message: 'Here\'s an example of an alert!',
	    location: 'left-bottom', 
	    timeout: 2500,
	    type: 'success', 
	    image: 'https://i.imgur.com/dJBzcGT.jpg'
	});

The above code will result in this notification (default styling):

.. image:: https://i.imgur.com/jRD5GAI.png

To style this, have a look at the vanilla theme's ``modules/alert.less`` and ``templates/alert.tpl``.

**Parameters**:

1. ``title`` - string, which can be a language string as well. Some core language strings that you can use here include: ``[[global:alert.success]]`` and ``[[global:alert.error]]``
2. ``message`` - string, which can be a language string as well.
3. ``location`` (optional) - ``right-top`` (default), ``left-top``, ``right-bottom``, ``left-bottom``
4. ``timeout`` (optional) - integer in milliseconds, default is permanent until closed.
5. ``type`` - error, success, info, warning/notify
6. ``image`` (optional) - string, URL to image.
7. ``closefn`` (optional) - function. This is called when the user closes the alert via the (X) button.
8. ``clickfn`` (optional) - function. This is called when the user clicks on the alert.