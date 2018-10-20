<div class="row manage-users">
	<div class="col-lg-12">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-user"></i> [[admin/manage/users:users]]</div>
			<div class="panel-body">

				<div class="clearfix">
					<div class="btn-group pull-right">
						<button class="btn btn-default dropdown-toggle" data-toggle="dropdown" type="button">[[admin/manage/users:edit]] <span class="caret"></span></button>
						<ul class="dropdown-menu">
							<li><a href="#" class="validate-email"><i class="fa fa-fw fa-check"></i> [[admin/manage/users:validate-email]]</a></li>
							<li><a href="#" class="send-validation-email"><i class="fa fa-fw fa-mail-forward"></i> [[admin/manage/users:send-validation-email]]</a></li>
							<li><a href="#" class="password-reset-email"><i class="fa fa-fw fa-key"></i> [[admin/manage/users:password-reset-email]]</a></li>
							<li class="divider"></li>
							<li><a href="#" class="ban-user"><i class="fa fa-fw fa-gavel"></i> [[admin/manage/users:ban]]</a></li>
							<li><a href="#" class="ban-user-temporary"><i class="fa fa-fw fa-clock-o"></i>[[admin/manage/users:temp-ban]]</a></li>
							<li><a href="#" class="unban-user"><i class="fa fa-fw fa-comment-o"></i> [[admin/manage/users:unban]]</a></li>
							<li><a href="#" class="reset-lockout"><i class="fa fa-fw fa-unlock"></i> [[admin/manage/users:reset-lockout]]</a></li>
							<li class="divider"></li>
							<li><a href="#" class="delete-user"><i class="fa fa-fw fa-trash-o"></i> [[admin/manage/users:delete]]</a></li>
							<li><a href="#" class="delete-user-and-content"><i class="fa fa-fw fa-trash-o"></i> [[admin/manage/users:purge]]</a></li>
						</ul>
					</div>

					<a target="_blank" href="{config.relative_path}/api/admin/users/csv" class="btn btn-primary pull-right">[[admin/manage/users:download-csv]]</a>

					<!-- IF inviteOnly -->
					<button component="user/invite" class="btn btn-success pull-right"><i class="fa fa-users"></i> [[admin/manage/users:invite]]</button>
					<!-- ENDIF inviteOnly -->

					<button id="createUser" class="btn btn-primary pull-right">[[admin/manage/users:new]]</button>
				</div>

				<ul class="nav nav-pills">
					<li><a href='{config.relative_path}/admin/manage/users/latest'>[[admin/manage/users:pills.latest]]</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/not-validated'>[[admin/manage/users:pills.unvalidated]]</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/no-posts'>[[admin/manage/users:pills.no-posts]]</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/top-posters'>[[admin/manage/users:pills.top-posters]]</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/most-reputation'>[[admin/manage/users:pills.top-rep]]</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/inactive'>[[admin/manage/users:pills.inactive]]</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/flagged'>[[admin/manage/users:pills.flagged]]</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/banned'>[[admin/manage/users:pills.banned]]</a></li>
					<li><a href='{config.relative_path}/admin/manage/users/search'>[[admin/manage/users:pills.search]]</a></li>
				</ul>

				<br />

				<div class="search {search_display}">
					<label>[[admin/manage/users:search.uid]]</label>
					<input class="form-control" id="search-user-uid" data-search-type="uid" type="number" placeholder="[[admin/manage/users:search.uid-placeholder]]"/><br />

					<label>[[admin/manage/users:search.username]]</label>
					<input class="form-control" id="search-user-name" data-search-type="username" type="text" placeholder="[[admin/manage/users:search.username-placeholder]]"/><br />

					<label>[[admin/manage/users:search.email]]</label>
					<input class="form-control" id="search-user-email" data-search-type="email" type="text" placeholder="[[admin/manage/users:search.email-placeholder]]"/><br />

					<label>[[admin/manage/users:search.ip]]</label>
					<input class="form-control" id="search-user-ip" data-search-type="ip" type="text" placeholder="[[admin/manage/users:search.ip-placeholder]]"/><br />

					<i class="fa fa-spinner fa-spin hidden"></i>
					<span id="user-notfound-notify" class="label label-danger hide">[[admin/manage/users:search.not-found]]</span><br/>
				</div>

				<!-- IF inactive -->
				<a href="{config.relative_path}/admin/manage/users/inactive?months=3" class="btn btn-default">[[admin/manage/users:inactive.3-months]]</a>
				<a href="{config.relative_path}/admin/manage/users/inactive?months=6" class="btn btn-default">[[admin/manage/users:inactive.6-months]]</a>
				<a href="{config.relative_path}/admin/manage/users/inactive?months=12" class="btn btn-default">[[admin/manage/users:inactive.12-months]]</a>
				<!-- ENDIF inactive -->

				<div class="table-responsive">
					<table class="table table-striped users-table">
						<thead>
							<tr>
								<th><input component="user/select/all" type="checkbox"/></th>
								<th>[[admin/manage/users:users.uid]]</th>
								<th>[[admin/manage/users:users.username]]</th>
								<th>[[admin/manage/users:users.email]]</th>
								<th class="text-right">[[admin/manage/users:users.postcount]]</th>
								<th class="text-right">[[admin/manage/users:users.reputation]]</th>
								<th class="text-right">[[admin/manage/users:users.flags]]</th>
								<th>[[admin/manage/users:users.joined]]</th>
								<th>[[admin/manage/users:users.last-online]]</th>
								<th>[[admin/manage/users:users.banned]]</th>
							</tr>
						</thead>
						<tbody>
							<!-- BEGIN users -->
							<tr class="user-row">
								<th><input component="user/select/single" data-uid="{users.uid}" type="checkbox"/></th>
								<td class="text-right">{users.uid}</td>
								<td><i class="administrator fa fa-shield text-success<!-- IF !users.administrator --> hidden<!-- ENDIF !users.administrator -->"></i><a href="{config.relative_path}/user/{users.userslug}"> {users.username}</a></td>

								<td>
								<!-- IF config.requireEmailConfirmation -->
								<i class="validated fa fa-check text-success<!-- IF !users.email:confirmed --> hidden<!-- ENDIF !users.email:confirmed -->" title="validated"></i>
								<i class="notvalidated fa fa-times text-danger<!-- IF users.email:confirmed --> hidden<!-- ENDIF users.email:confirmed -->" title="not validated"></i>
								<!-- ENDIF config.requireEmailConfirmation --> {users.email}</td>
								<td class="text-right">{users.postcount}</td>
								<td class="text-right">{users.reputation}</td>
								<td class="text-right"><!-- IF users.flags -->{users.flags}<!-- ELSE -->0<!-- ENDIF users.flags --></td>
								<td><span class="timeago" title="{users.joindateISO}"></span></td>
								<td><span class="timeago" title="{users.lastonlineISO}"></span></td>
								<td class="text-center"><i class="ban fa fa-gavel text-danger<!-- IF !users.banned --> hidden<!-- ENDIF !users.banned -->"></i></td>
							</tr>
							<!-- END users -->
						</tbody>
					</table>
				</div>

				<!-- IMPORT partials/paginator.tpl -->
			</div>
		</div>
	</div>
</div>
