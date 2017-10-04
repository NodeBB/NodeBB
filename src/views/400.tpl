<div class="alert alert-danger">
	<strong>[[global:400.title]]</strong>
	<!-- IF error -->
	<p>{error}</p>
	<!-- ELSE -->
	<p>[[global:400.message, {config.relative_path}]]</p>
	<!-- ENDIF error -->

	<!-- IF returnLink -->
	<p>[[error:goback]]</p>
	<!-- ENDIF returnLink -->
</div>
