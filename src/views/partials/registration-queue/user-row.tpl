<tr data-username="{./username}" class="align-middle">
	<td>
		<input class="form-check-input border-secondary" component="registration-queue/select/single" data-username="{./username}" type="checkbox" {{{ if ./spamSuspected }}}checked{{{ end }}}/>
	</td>
	<td>
		{{{ if ./usernameSpam }}}
		<i class="fa fa-times-circle text-danger" title="{{tx("registration-queue:list.username-spam", ./spamData.username.frequency, ./spamData.username.appears, ./spamData.username.confidence)}}" data-bs-toggle="tooltip" data-bs-html="true"></i>
		{{{ else }}}
		{{{ if ./spamChecked }}}
		<i class="fa fa-check text-success"></i>
		{{{ end }}}
		{{{ end }}}
		{./username}
		{{{ if ./sso }}}
		<i class="{./sso.icon}" title="{./sso.name}"></i>
		{{{ end }}}
	</td>
	<td>
		{{{ if ./emailSpam }}}
		<i class="fa fa-times-circle text-danger" title="{{tx("registration-queue:list.email-spam", ./spamData.email.frequency, ./spamData.email.appears, ./spamData.email.confidence)}}" data-bs-toggle="tooltip" data-bs-html="true"></i>
		{{{ else }}}
		{{{ if ./spamChecked }}}
		<i class="fa fa-check text-success"></i>
		{{{ end }}}
		{{{ end }}}
		{./email}
	</td>
	<td class="hidden-xs">
		<div class="d-flex gap-2 align-items-center">
			{{{ if ./ipSpam }}}
			<i class="fa fa-times-circle text-danger" title="{{tx("registration-queue:list.ip-spam", ./spamData.ip.frequency, ./spamData.ip.appears, ./spamData.ip.confidence)}}" data-bs-toggle="tooltip" data-bs-html="true"></i>
			{{{ else }}}
			{{{ if ./spamChecked }}}
			<i class="fa fa-check text-success"></i>
			{{{ end }}}
			{{{ end }}}
			{./ip}
			{{{ if ./ipMatch.length }}}
			<div class="dropdown position-static">
				<button type="button" class="btn btn-ghost btn-sm dropdown-toggle border" data-bs-toggle="dropdown" aria-expanded="false">{./ipMatch.length} <i class="fa-solid fa-users"></i></button>
				<ul class="dropdown-menu p-1 overflow-auto" style="max-height:300px;">
					{{{ each ./ipMatch}}}
					<li class="d-flex gap-1 align-items-center">
						<a href="{config.relative_path}/uid/{./uid}" class="dropdown-item rounded-1">{{buildAvatar(@value, "24px", true)}} {./username}</a>
					</li>
					{{{ end }}}
				</ul>
			</div>
			{{{ end }}}
		</div>
	</td>
	<td class="hidden-xs">
		<span class="timeago" title="{./timestampISO}"></span>
	</td>

	{{{ each ./customRows }}}
	<td class="hidden-xs">{./value}</td>
	{{{ end }}}

	<td>
		<div class="d-flex gap-1 justify-content-end">
			<button class="btn btn-light btn-sm" data-action="accept"><i class="fa fa-check text-success"></i></button>
			<button class="btn btn-light btn-sm" data-action="delete"><i class="fa fa-trash text-danger"></i></button>
			{{{ each ./customActions }}}
			<button id="{./id}" title="{{tx(./title)}}" class="btn btn-sm {./class}">
				<i class="fa {./icon}"></i>
			</button>
			{{{ end }}}
		</div>
	</td>
</tr>
