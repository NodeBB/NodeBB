<div class="account">
	<!-- IMPORT partials/account/header.tpl -->

	<!-- IF sessions.length -->
	<div class="row">
		<div class="col-xs-12 col-md-12">
			<p class="lead">[[user:sessions.description]]</p>
			<hr />
			<ul class="list-group" component="user/sessions">
				{{{each sessions}}}
				<li class="list-group-item" data-uuid="{../uuid}">
					<div class="pull-right">
						<!-- IF isSelfOrAdminOrGlobalModerator -->
						<!-- IF !../current -->
						<button class="btn btn-xs btn-default" type="button" data-action="revokeSession">Revoke Session</button>
						<!-- ENDIF !../current -->
						<!-- ENDIF isSelfOrAdminOrGlobalModerator -->
						{function.userAgentIcons}
						<i class="fa fa-circle text-<!-- IF ../current -->success<!-- ELSE -->muted<!-- ENDIF ../current -->"></i>
					</div>
					{../browser} {../version} on {../platform}<br />
					<small class="timeago text-muted" title="{../datetimeISO}"></small>
					<ul>
						<li><strong>[[global:ip_address]]</strong>: {../ip}</li>
					</ul>
				</li>
				{{{end}}}
			</ul>
		</div>
	</div>
	<!-- ENDIF sessions.length -->
</div>