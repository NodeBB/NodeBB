<div class="account">
	<!-- IMPORT partials/account/header.tpl -->

	<div class="row">
		<h1>[[pages:{template.name}, {username}]]</h1>
		
		<div class="groups list">
			<div component="groups/container" id="groups-list" class="row">
				<!-- IF !groups.length -->
				<div class="alert alert-warning text-center">[[groups:no_groups_found]]</div>
				<!-- ELSE -->
				<!-- IMPORT partials/groups/list.tpl -->
				<!-- ENDIF !groups.length -->
			</div>
		</div>
	</div>
</div>