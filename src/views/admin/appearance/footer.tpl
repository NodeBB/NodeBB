
</div>

<script>
	var bootswatchListener = function(data) {
		require(['forum/admin/themes'], function(t) {
			t.render(data);
		});
	};

	require(['forum/admin/themes'], function(t) {
		t.init();
	});
</script>