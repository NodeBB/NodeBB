<h1>Categories Unit Tests</h1>
<hr />

<div id="qunit"></div>
<div id="qunit-fixture"></div>

<script type="text/javascript">
jQuery(document).ready(function () {

	QUnit.init();
	asyncTest( "Loading Categories", function() {

		jQuery.get(RELATIVE_PATH + '/api/home', function(data) {
			ok( data.categories.length > 0, JSON.stringify(data.categories) );

			start();

			for (var i = 0, ii = data.categories.length; i < ii; i++) {
				var category = data.categories[i],
					slug = 'category/' + category.slug;

				asyncTest( "Loading Category '" + category.name + "' located at " + slug, function() {
					jQuery.get(RELATIVE_PATH + '/api/' + slug, function(data) {
						ok( data.category_name, JSON.stringify(data) ); //todo: check this against data.categories
						start();
					});
				});
			}
		});
	});

	QUnit.start();
});
</script>