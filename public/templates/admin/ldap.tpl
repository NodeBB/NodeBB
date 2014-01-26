<h1><i class="fa fa-list-alt"></i> LDAP Authentication</h1>
<hr />

<form>
	<div class="alert alert-warning">
		<p>
			LDAP Settings
		</p>
		<br />
		<input type="text" data-field="authentication:ldap:url" title="LDAP Server URL" class="form-control input-lg" placeholder="LDAP Server URL"><br />
		<input type="text" data-field="authentication:ldap:adminDn" title="Admin Domain" class="form-control input-md" placeholder="Admin Domain"><br />
		<input type="text" data-field="authentication:ldap:adminPassword" title="Admin Password" class="form-control input-md" placeholder="Admin Password"><br />
		<input type="text" data-field="authentication:ldap:searchBase" title="Search base" class="form-control input-md" placeholder="Search Base"><br />
		<input type="text" data-field="authentication:ldap:searchFilter" title="Search Filter" class="form-control input-md" placeholder="Search Filter"><br />
	</div>
</form>

<button class="btn btn-lg btn-primary" id="save">Save</button>

<script>
	require(['forum/admin/settings'], function(Settings) {
		Settings.prepare();
	});
</script>