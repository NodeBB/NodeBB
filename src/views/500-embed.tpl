<script>
define('/assets/templates/500.jst', function () {
	function compiled(helpers, context, get, iter, helper) {
		return '<div class="alert alert-danger">\n\t<strong>[[global:500.title]]</strong>\n\t<p>[[global:500.message]]</p>\n\t<p>' + 
    		helpers.__escape(get(context && context['path'])) + '</p>\n\t' + 
			(get(context && context['error']) ? '<p>' + helpers.__escape(get(context && context['error'])) + '</p>' : '') + '\n\n\t' + 
			(get(context && context['returnLink']) ? '\n\t<a href="' + (get(context && context['returnLink'])) + '">[[error:goback]]</a>\n\t' : '') + '\n</div>\n';
	}

	return compiled;
});
</script>