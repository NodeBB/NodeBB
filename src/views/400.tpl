<div class="alert alert-danger">
	<strong>[[global:400.title]]</strong>
	<!-- IF error -->
	<p>{error}</p>
	<!-- ELSE -->
	<p>[[global:400.message, {config.relative_path}]]</p>
	<!-- ENDIF error -->

	<!-- IF returnLink -->
	<a href="{returnLink}">[[error:goback]]</a>
	<!-- ENDIF returnLink -->
</div>
