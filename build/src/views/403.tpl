<div class="alert alert-danger">
	<strong>[[global:403.title]]</strong>
	<!-- IF error -->
	<p>{error}</p>
	<!-- ELSE -->
	<p>[[global:403.message]]</p>
	<!-- ENDIF error -->

	<!-- IF returnLink -->
	<p>[[error:goback]]</p>
	<!-- ENDIF returnLink -->

	<!-- IF !loggedIn -->
	<p>[[global:403.login, {config.relative_path}]]</p>
	<!-- ENDIF !loggedIn -->
</div>