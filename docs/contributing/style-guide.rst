NodeBB Style Guide
==================

For the most part, NodeBB follows the `Google Javascript Style Guide <http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml>`_.

Code Formatting
-------------------

.. note::
	
	The existing codebase as of July 2013 does not adhere to this style guide 100%. If you see instances where the style guide is not adhered to, feel free to restyle and send off a pull request.

Indentation & Bracing
-------------------

NodeBB uses tabbed indentation. Bracing should follow the `One True Brace Style <http://en.wikipedia.org/wiki/Indent_style#Variant:_1TBS>`_:

.. code:: javascript

    if (condition) {
        // code here ...
    } else {
        // otherwise ...
    }

Put conditionals and statements on separate lines and wrap with curly braces even if it's just one line:

.. code:: javascript

    if (leTired) {
        haveANap();
    }

Errors
-------------------

Most callbacks return an error as the first parameter. Handle this error first before processing further.

.. code:: javascript

    someFunction(parameters, function(err, data) {
        if(err) {
           return callback(err); // or handle error
        }
        // proceed as usual
    });

Variables
-------------------

Variables should always be prefaced with the `var` keyword:

.. code:: javascript

    var foo = 'bar';

Multiple declarations are to be included in the same `var` statement:

.. code:: javascript

    var foo = 'bar',
        bar = 'baz';

Semicolons
-------------------

Use semicolons if at all possible

Nomenclature
-------------------

CamelCase if at all possible:

.. code:: javascript

	functionNamesLikeThis, variableNamesLikeThis, ClassNamesLikeThis, EnumNamesLikeThis, methodNamesLikeThis, CONSTANT_VALUES_LIKE_THIS, foo.namespaceNamesLikeThis.bar, and filenameslikethis.js.
