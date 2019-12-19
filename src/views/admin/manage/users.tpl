<div class="row manage-users">
	<div class="col-lg-12">
		<div class="clearfix">
			<form class="form-inline pull-right">
				<button id="createUser" class="btn btn-primary">[[admin/manage/users:new]]</button>
				<!-- IF inviteOnly -->
				<button component="user/invite" class="btn btn-success"><i class="fa fa-users"></i> [[admin/manage/users:invite]]</button>
				<!-- ENDIF inviteOnly -->
				<a target="_blank" href="{config.relative_path}/api/admin/users/csv" class="btn btn-primary">[[admin/manage/users:download-csv]]</a>
				<div class="btn-group">
					<button class="btn btn-default dropdown-toggle" data-toggle="dropdown" type="button">[[admin/manage/users:edit]] <span class="caret"></span></button>
					<ul class="dropdown-menu dropdown-menu-right">
						<li><a href="#" class="validate-email"><i class="fa fa-fw fa-check"></i> [[admin/manage/users:validate-email]]</a></li>
						<li><a href="#" class="send-validation-email"><i class="fa fa-fw fa-mail-forward"></i> [[admin/manage/users:send-validation-email]]</a></li>
						<li><a href="#" class="password-reset-email"><i class="fa fa-fw fa-key"></i> [[admin/manage/users:password-reset-email]]</a></li>
						<li><a href="#" class="force-password-reset"><i class="fa fa-fw fa-unlock-alt"></i> [[admin/manage/users:force-password-reset]]</a></li>
						<li><a href="#" class="manage-groups"><i class="fa fa-fw fa-users"></i> [[admin/manage/users:manage-groups]]</a></li>
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
			</form>
		</div>
		<hr/>
		<ul class="nav nav-pills">
			<li><a href='{config.relative_path}/admin/manage/users/latest?resultsPerPage={resultsPerPage}'>[[admin/manage/users:pills.latest]]</a></li>
			<li><a href='{config.relative_path}/admin/manage/users/not-validated?resultsPerPage={resultsPerPage}'>[[admin/manage/users:pills.unvalidated]]</a></li>
			<li><a href='{config.relative_path}/admin/manage/users/no-posts?resultsPerPage={resultsPerPage}'>[[admin/manage/users:pills.no-posts]]</a></li>
			<li><a href='{config.relative_path}/admin/manage/users/top-posters?resultsPerPage={resultsPerPage}'>[[admin/manage/users:pills.top-posters]]</a></li>
			<li><a href='{config.relative_path}/admin/manage/users/most-reputation?resultsPerPage={resultsPerPage}'>[[admin/manage/users:pills.top-rep]]</a></li>
			<li><a href='{config.relative_path}/admin/manage/users/inactive?resultsPerPage={resultsPerPage}'>[[admin/manage/users:pills.inactive]]</a></li>
			<li><a href='{config.relative_path}/admin/manage/users/flagged?resultsPerPage={resultsPerPage}'>[[admin/manage/users:pills.flagged]]</a></li>
			<li><a href='{config.relative_path}/admin/manage/users/banned?resultsPerPage={resultsPerPage}'>[[admin/manage/users:pills.banned]]</a></li>
			<li><a href='{config.relative_path}/admin/manage/users/search'>[[admin/manage/users:pills.search]]</a></li>
			<li class="pull-right">
				<form class="form-inline">
					<select id="results-per-page" class="form-control">
						<option value="50">[[admin/manage/users:50-per-page]]</option>
						<option value="100">[[admin/manage/users:100-per-page]]</option>
						<option value="250">[[admin/manage/users:250-per-page]]</option>
						<option value="500">[[admin/manage/users:500-per-page]]</option>
					</select>
				</form>
			</li>
		</ul>

		<br />

		<div class="search {search_display}">
			<form class="form-inline">
				<div class="form-group">
					<label>[[admin/manage/users:search.uid]]</label>
					<input class="form-control" id="search-user-uid" data-search-type="uid" type="number" placeholder="[[admin/manage/users:search.uid-placeholder]]"/><br />
				</div>
				<div class="form-group">
					<label>[[admin/manage/users:search.username]]</label>
					<input class="form-control" id="search-user-name" data-search-type="username" type="text" placeholder="[[admin/manage/users:search.username-placeholder]]"/><br />
				</div>
				<div class="form-group">
					<label>[[admin/manage/users:search.email]]</label>
					<input class="form-control" id="search-user-email" data-search-type="email" type="text" placeholder="[[admin/manage/users:search.email-placeholder]]"/><br />
				</div>
				<div class="form-group">
					<label>[[admin/manage/users:search.ip]]</label>
					<input class="form-control" id="search-user-ip" data-search-type="ip" type="text" placeholder="[[admin/manage/users:search.ip-placeholder]]"/><br />
				</div>
			</form>
			<i class="fa fa-spinner fa-spin hidden"></i>
			<span id="user-notfound-notify" class="label label-danger hide">[[admin/manage/users:search.not-found]]</span><br/>
		</div>

		<!-- IF inactive -->
		<a href="{config.relative_path}/admin/manage/users/inactive?months=3&resultsPerPage={resultsPerPage}" class="btn btn-default">[[admin/manage/users:inactive.3-months]]</a>
		<a href="{config.relative_path}/admin/manage/users/inactive?months=6&resultsPerPage={resultsPerPage}" class="btn btn-default">[[admin/manage/users:inactive.6-months]]</a>
		<a href="{config.relative_path}/admin/manage/users/inactive?months=12&resultsPerPage={resultsPerPage}" class="btn btn-default">[[admin/manage/users:inactive.12-months]]</a>
		<!-- ENDIF inactive -->

		<div class="table-responsive">
			<table class="table table-striped users-table">
				<thead>
					<tr>
						<th><input component="user/select/all" type="checkbox"/></th>
						<th class="text-right">[[admin/manage/users:users.uid]]</th>
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
