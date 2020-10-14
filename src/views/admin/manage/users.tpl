<div class="row manage-users">
	<div class="col-lg-12">
		<div class="clearfix">
			<form class="form-inline pull-right">
				<div class="input-group">
					<input type="text" class="form-control" placeholder="[[global:search]]" id="user-search" value="{query}">
					<span class="input-group-addon search-button"><i class="fa fa-search"></i></span>
				</div>
				<select id="user-search-by" class="form-control">
					<option value="username" {{{if searchBy_username}}}selected{{{end}}}>[[admin/manage/users:search.username]]</option>
					<option value="email" {{{if searchBy_email}}}selected{{{end}}}>[[admin/manage/users:search.email]]</option>
					<option value="uid" {{{if searchBy_uid}}}selected{{{end}}}>[[admin/manage/users:search.uid]]</option>
					<option value="ip" {{{if searchBy_ip}}}selected{{{end}}}>[[admin/manage/users:search.ip]]</option>
				</select>
				<select id="results-per-page" class="form-control">
					<option value="50">[[admin/manage/users:50-per-page]]</option>
					<option value="100">[[admin/manage/users:100-per-page]]</option>
					<option value="250">[[admin/manage/users:250-per-page]]</option>
					<option value="500">[[admin/manage/users:500-per-page]]</option>
				</select>
			</form>

		</div>
		<hr/>
		<ul class="nav nav-pills">
			<li class="pull-right">
				<div class="btn-group" id="filter-by">
					<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">
						[[admin/manage/users:filter-by]] <span class="caret"></span>
					</button>
					<ul class="dropdown-menu dropdown-menu-right" role="menu">
						<li data-filter-by="unverified" role="presentation">
							<a role="menu-item" href="#"><i class="fa fa-fw {{{ if filterBy_unverified }}}fa-check{{{end}}}"></i>[[admin/manage/users:pills.unvalidated]]</a>
						</li>
						<li data-filter-by="verified" role="presentation">
							<a role="menu-item" href="#"><i class="fa fa-fw {{{ if filterBy_verified }}}fa-check{{{end}}}"></i>[[admin/manage/users:pills.validated]]</a>
						</li>
						<li data-filter-by="banned" role="presentation">
							<a role="menu-item" href="#"><i class="fa fa-fw {{{ if filterBy_banned }}}fa-check{{{end}}}"></i>[[admin/manage/users:pills.banned]]</a>
						</li>
					</ul>
				</div>
			</li>
			<li class="pull-right">
				<form class="form-inline">
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
							<li><a href="#" class="ban-user-temporary"><i class="fa fa-fw fa-clock-o"></i> [[admin/manage/users:temp-ban]]</a></li>
							<li><a href="#" class="unban-user"><i class="fa fa-fw fa-comment-o"></i> [[admin/manage/users:unban]]</a></li>
							<li><a href="#" class="reset-lockout"><i class="fa fa-fw fa-unlock"></i> [[admin/manage/users:reset-lockout]]</a></li>
							<li class="divider"></li>
							<li><a href="#" class="delete-user"><i class="fa fa-fw fa-trash-o"></i> [[admin/manage/users:delete]]</a></li>
							<li><a href="#" class="delete-user-content"><i class="fa fa-fw fa-trash-o"></i> [[admin/manage/users:delete-content]]</a></li>
							<li><a href="#" class="delete-user-and-content"><i class="fa fa-fw fa-trash-o"></i> [[admin/manage/users:purge]]</a></li>
						</ul>
					</div>
				</form>
			</li>
		</ul>

		<br />

		<div class="search {search_display}">
			<i class="fa fa-spinner fa-spin hidden"></i>

			<div id="user-found-notify" class="label label-info {{{if !matchCount}}}hidden{{{end}}}">[[admin/manage/users:alerts.x-users-found, {matchCount}, {timing}]]</div>

			<div id="user-notfound-notify" class="label label-danger {{{if !query}}}hidden{{{end}}} {{{if matchCount}}}hidden{{{end}}}">[[admin/manage/users:search.not-found]]</div>
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
						<th class="text-right text-muted">[[admin/manage/users:users.uid]]</th>
						<th class="text-muted">[[admin/manage/users:users.username]]</th>
						<th class="text-muted">[[admin/manage/users:users.email]]</th>
						<th data-sort="postcount" class="text-right pointer">[[admin/manage/users:users.postcount]] {{{if sort_postcount}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
						<th data-sort="reputation" class="text-right pointer">[[admin/manage/users:users.reputation]] {{{if sort_reputation}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
						<th data-sort="flags" class="text-right pointer">[[admin/manage/users:users.flags]] {{{if sort_flags}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
						<th data-sort="joindate" class="pointer">[[admin/manage/users:users.joined]] {{{if sort_joindate}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
						<th data-sort="online" class="pointer">[[admin/manage/users:users.last-online]] {{{if sort_online}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
					</tr>
				</thead>
				<tbody>
					<!-- BEGIN users -->
					<tr class="user-row">
						<th><input component="user/select/single" data-uid="{users.uid}" type="checkbox"/></th>
						<td class="text-right">{users.uid}</td>
						<td><i title="[[admin/manage/users:users.banned]]" class="ban fa fa-gavel text-danger<!-- IF !users.banned --> hidden<!-- ENDIF !users.banned -->"></i><i class="administrator fa fa-shield text-success<!-- IF !users.administrator --> hidden<!-- ENDIF !users.administrator -->"></i><a href="{config.relative_path}/user/{users.userslug}"> {users.username}</a></td>

						<td>
						<i class="validated fa fa-check text-success<!-- IF !users.email:confirmed --> hidden<!-- ENDIF !users.email:confirmed -->" title="validated"></i>
						<i class="notvalidated fa fa-check text-muted<!-- IF users.email:confirmed --> hidden<!-- ENDIF users.email:confirmed -->" title="not validated"></i>
						 {users.email}</td>
						<td class="text-right">{users.postcount}</td>
						<td class="text-right">{users.reputation}</td>
						<td class="text-right"><!-- IF users.flags -->{users.flags}<!-- ELSE -->0<!-- ENDIF users.flags --></td>
						<td><span class="timeago" title="{users.joindateISO}"></span></td>
						<td><span class="timeago" title="{users.lastonlineISO}"></span></td>
					</tr>
					<!-- END users -->
				</tbody>
			</table>
		</div>

		<!-- IMPORT partials/paginator.tpl -->

	</div>
</div>

<button data-action="create" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">add</i>
</button>