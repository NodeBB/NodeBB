<div class="manage-users d-flex flex-column gap-2 px-lg-4 h-100">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/users:manage-users]]</h4>
		</div>
		<div class="d-flex align-items-center gap-3 flex-wrap">
			<div class="d-flex gap-1 align-items-stretch flex-wrap">
				<div class="input-group flex-nowrap w-auto">
					<input type="text" class="form-control form-control-sm w-auto" placeholder="[[global:search]]" id="user-search" value="{query}">
					<span class="input-group-text px-2 search-button"><i class="fa fa-search"></i></span>
				</div>
				<select id="user-search-by" class="form-select form-select-sm w-auto">
					<option value="username" {{{if searchBy_username}}}selected{{{end}}}>[[admin/manage/users:search.username]]</option>
					<option value="email" {{{if searchBy_email}}}selected{{{end}}}>[[admin/manage/users:search.email]]</option>
					<option value="uid" {{{if searchBy_uid}}}selected{{{end}}}>[[admin/manage/users:search.uid]]</option>
					<option value="ip" {{{if searchBy_ip}}}selected{{{end}}}>[[admin/manage/users:search.ip]]</option>
				</select>
				<select id="results-per-page" class="form-select form-select-sm w-auto">
					<option value="50">[[admin/manage/users:50-per-page]]</option>
					<option value="100">[[admin/manage/users:100-per-page]]</option>
					<option value="250">[[admin/manage/users:250-per-page]]</option>
					<option value="500">[[admin/manage/users:500-per-page]]</option>
				</select>
				<div class="btn-group" id="filter-by">
					<button type="button" class="btn btn-light btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
						[[admin/manage/users:filter-by]] <span class="caret"></span>
					</button>
					<ul class="dropdown-menu" role="menu">
						<li data-filter-by="unverified" role="presentation">
							<a class="dropdown-item" role="menuitem" href="#"><i class="fa fa-fw {{{ if filterBy_unverified }}}fa-check{{{end}}}"></i>[[admin/manage/users:pills.unvalidated]]</a>
						</li>
						<li data-filter-by="verified" role="presentation">
							<a class="dropdown-item" role="menuitem" href="#"><i class="fa fa-fw {{{ if filterBy_verified }}}fa-check{{{end}}}"></i>[[admin/manage/users:pills.validated]]</a>
						</li>
						<li data-filter-by="banned" role="presentation">
							<a class="dropdown-item" role="menuitem" href="#"><i class="fa fa-fw {{{ if filterBy_banned }}}fa-check{{{end}}}"></i>[[admin/manage/users:pills.banned]]</a>
						</li>
					</ul>
				</div>
				<div class="btn-group">
					<button class="btn btn-primary btn-sm dropdown-toggle" id="action-dropdown" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" type="button" disabled="disabled">[[admin/manage/users:edit]] <span class="caret"></span></button>
					<ul class="dropdown-menu dropdown-menu-end p-1 text-sm overflow-auto" role="menu" style="max-height:75vh;">

						<li><h6 class="dropdown-header">[[admin/manage/users:email]]</h6></li>
						<li><a href="#" class="dropdown-item rounded-1 change-email" role="menuitem"><i class="text-secondary fa fa-fw fa-envelope text-start"></i> [[admin/manage/users:change-email]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 validate-email" role="menuitem"><i class="text-secondary fa fa-fw fa-envelope-circle-check"></i> [[admin/manage/users:validate-email]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 send-validation-email" role="menuitem"><i class="text-secondary fa fa-fw fa-mail-forward"></i> [[admin/manage/users:send-validation-email]]</a></li>

						<li><hr class="dropdown-divider"></li>

						<li><h6 class="dropdown-header">[[admin/manage/users:password]]</h6></li>
						<li><a href="#" class="dropdown-item rounded-1 change-password" role="menuitem"><i class="text-secondary fa fa-fw fa-key"></i> [[admin/manage/users:change-password]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 password-reset-email" role="menuitem"><i class="text-secondary fa fa-fw fa-envelope-open-text"></i> [[admin/manage/users:password-reset-email]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 force-password-reset" role="menuitem"><i class="text-secondary fa fa-fw fa-user-lock"></i> [[admin/manage/users:force-password-reset]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 reset-lockout" role="menuitem"><i class="text-secondary fa fa-fw fa-lock-open"></i> [[admin/manage/users:reset-lockout]]</a></li>

						<li><hr class="dropdown-divider"></li>

						<li><h6 class="dropdown-header">[[admin/manage/users:manage]]</h6></li>
						<li><a href="#" class="dropdown-item rounded-1 manage-groups" role="menuitem"><i class="text-secondary fa fa-fw fa-users"></i> [[admin/manage/users:manage-groups]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 set-reputation" role="menuitem"><i class="text-secondary fa fa-fw fa-star"></i> [[admin/manage/users:set-reputation]]</a></li>

						<li><hr class="dropdown-divider"></li>

						<li><h6 class="dropdown-header">[[admin/manage/users:ban]]</h6></li>
						<li><a href="#" class="dropdown-item rounded-1 ban-user" role="menuitem"><i class="text-secondary fa fa-fw fa-gavel"></i> [[admin/manage/users:ban-users]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 ban-user-temporary" role="menuitem"><i class="text-secondary fa fa-fw fa-clock-o"></i> [[admin/manage/users:temp-ban]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 unban-user" role="menuitem"><i class="text-secondary fa fa-fw fa-comment-o"></i> [[admin/manage/users:unban]]</a></li>

						<li><hr class="dropdown-divider"></li>

						<li><h6 class="dropdown-header">[[admin/manage/users:delete]]</h6></li>
						<li><a href="#" class="dropdown-item rounded-1 delete-user" role="menuitem"><i class="text-secondary fa fa-fw fa-trash-o"></i> [[admin/manage/users:delete-users]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 delete-user-content" role="menuitem"><i class="text-secondary fa fa-fw fa-trash-o"></i> [[admin/manage/users:delete-content]]</a></li>
						<li><a href="#" class="dropdown-item rounded-1 delete-user-and-content" role="menuitem"><i class="text-secondary fa fa-fw fa-trash-o"></i> [[admin/manage/users:purge]]</a></li>
					</ul>
				</div>
				<div class="btn-group">
					<button class="btn btn-light btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false" type="button"><i class="fa fa-gear text-primary"></i></button>
					<ul class="dropdown-menu dropdown-menu-end p-1" role="menu">
						<li><a class="dropdown-item rounded-1" href="#" data-action="create" role="menuitem">[[admin/manage/users:create]]</a></li>
						{{{ if showInviteButton }}}<li><a class="dropdown-item rounded-1" href="#" component="user/invite" role="menuitem">[[admin/manage/users:invite]]</a></li>{{{ end }}}
						<li><a target="_blank" href="#" class="dropdown-item rounded-1 export-csv" role="menuitem">[[admin/manage/users:download-csv]]</a></li>
						<li><a class="dropdown-item rounded-1" href="{relative_path}/admin/manage/users/custom-fields">[[admin/manage/users:custom-user-fields]]</a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>

	<div class="row flex-grow-1">
		<div class="col-lg-12 d-flex flex-column gap-2">
			<div class="search {search_display}">
				<i class="fa fa-spinner fa-spin hidden"></i>

				<div id="user-found-notify" class="badge text-bg-light {{{if !matchCount}}}hidden{{{end}}}">[[admin/manage/users:alerts.x-users-found, {matchCount}, {timing}]]</div>

				<div id="user-notfound-notify" class="badge text-bg-warning {{{if !query}}}hidden{{{end}}} {{{if matchCount}}}hidden{{{end}}}">[[admin/manage/users:search.not-found]]</div>
			</div>

			<div class="table-responsive flex-grow-1">
				<table class="table users-table text-sm">
					<thead>
						<tr>
							<th><input component="user/select/all" type="checkbox"/></th>
							<th class="text-end text-muted">[[admin/manage/users:users.uid]]</th>
							<th class="text-muted">[[admin/manage/users:users.username]]</th>
							<th class="text-muted">[[admin/manage/users:users.email]]</th>
							<th class="text-muted">[[admin/manage/users:users.ip]]</th>
							<th data-sort="postcount" class="text-end pointer text-nowrap">[[admin/manage/users:users.postcount]] {{{if sort_postcount}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
							<th data-sort="reputation" class="text-end pointer text-nowrap">[[admin/manage/users:users.reputation]] {{{if sort_reputation}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
							<th data-sort="flags" class="text-end pointer text-nowrap">[[admin/manage/users:users.flags]] {{{if sort_flags}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
							<th data-sort="joindate" class="pointer text-nowrap">[[admin/manage/users:users.joined]] {{{if sort_joindate}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
							<th data-sort="lastonline" class="pointer text-nowrap">[[admin/manage/users:users.last-online]] {{{if sort_lastonline}}}<i class="fa fa-sort-{{{if reverse}}}down{{{else}}}up{{{end}}}">{{{end}}}</th>
						</tr>
					</thead>
					<tbody>
						{{{ each users }}}
						<tr class="user-row align-middle">
							<th><input component="user/select/single" data-uid="{users.uid}" type="checkbox"/></th>
							<td class="text-end">{users.uid}</td>
							<td>
								<i title="[[admin/manage/users:users.banned]]" class="ban fa fa-gavel text-danger{{{ if !users.banned }}} hidden{{{ end }}}"></i>
								<i class="administrator fa fa-shield text-success{{{ if !users.administrator }}} hidden{{{ end }}}"></i>
								<a href="{config.relative_path}/user/{users.userslug}"> {users.username}</a>
							</td>
							<td class="text-nowrap">
								<div class="d-flex flex-column gap-1">
									<em class="text-muted no-email {{{ if (./email || ./emailToConfirm) }}}hidden{{{ end }}} ">[[admin/manage/users:users.no-email]]</em>

									<span class="validated {{{ if !users.email:confirmed }}} hidden{{{ end }}}">
										<i class="fa fa-fw fa-check text-success" title="[[admin/manage/users:users.validated]]" data-bs-toggle="tooltip"></i>
										<span class="email">{{{ if ./email }}}{./email}{{{ end }}}</span>
									</span>

									<span class="validated-by-admin hidden">
										<i class="fa fa-fw fa-check text-success" title="[[admin/manage/users:users.validated]]" data-bs-toggle="tooltip"></i>
										<span class="email">{{{ if ./emailToConfirm }}}{./emailToConfirm}{{{ end }}}</span>
									</span>

									<span class="pending {{{ if (!./emailToConfirm || !users.email:pending) }}} hidden{{{ end }}}">
										<i class="fa fa-fw fa-clock-o text-warning" title="[[admin/manage/users:users.validation-pending]]" data-bs-toggle="tooltip"></i>
										<span class="email">{./emailToConfirm}</span>
									</span>

									<span class="expired {{{ if (!./emailToConfirm || !users.email:expired) }}} hidden{{{ end }}}">
										<i class="fa fa-fw fa-times text-danger" title="[[admin/manage/users:users.validation-expired]]" data-bs-toggle="tooltip"></i>
										<span class="email">{./emailToConfirm}</span>
									</span>

									<span class="notvalidated {{{ if (!./emailToConfirm || (users.email:expired || (users.email:pending || users.email:confirmed))) }}} hidden{{{ end }}}">
										<i class="fa fa-fw fa-times text-danger" title="[[admin/manage/users:users.not-validated]]" data-bs-toggle="tooltip"></i>
										<span class="email">{./emailToConfirm}</span>
									</span>
								</div>
							</td>
							<td>
								{{{ if ./ips.length }}}
								<div class="dropdown">
									<button class="btn btn-light btn-sm" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><i class="fa fa-fw fa-list text-muted"></i></button>
									<ul class="dropdown-menu p-1" role="menu">
										{{{ each ./ips }}}
										<li class="d-flex gap-1 {{{ if !@last }}}mb-1{{{ end }}}">
											<a class="dropdown-item rounded-1" role="menuitem">{@value}</a>
											<button data-ip="{@value}" onclick="navigator.clipboard.writeText(this.getAttribute('data-ip'))" class="btn btn-light btn-sm"><i class="fa fa-copy"></i></button>
										</li>
										{{{ end }}}
									</ul>
								</div>
								{{{ end }}}
							</td>
							<td class="text-end">{formattedNumber(users.postcount)}</td>
							<td class="text-end" component="user/reputation" data-uid="{users.uid}">{formattedNumber(users.reputation)}</td>
							<td class="text-end">{{{ if users.flags }}}{users.flags}{{{ else }}}0{{{ end }}}</td>
							<td><span class="timeago" title="{users.joindateISO}"></span></td>
							<td><span class="timeago" title="{users.lastonlineISO}"></span></td>
						</tr>
						{{{ end }}}
					</tbody>
				</table>
			</div>

			<!-- IMPORT admin/partials/paginator.tpl -->
		</div>
	</div>
</div>