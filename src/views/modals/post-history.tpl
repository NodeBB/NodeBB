<p class="number-of-diffs">
	{{{ if numDiffs }}}
	{{tx("topic:diffs.description", numDiffs)}}
	{{{ else }}}
	{{tx("topic:diffs.no-revisions-description", numDiffs)}}
	{{{ end }}}
</p>
{{{ if numDiffs }}}
<div class="mb-3">
	<select class="form-control">
		{{{ each diffs }}}
		<option value="{../timestamp}">
			{./pretty}
			{{{ if ./username }}}[{./username}]{{{ end }}}
			{{{ if @first }}}{{tx("topic:diffs.current-revision")}}{{{ end }}}
			{{{ if @last }}}{{tx("topic:diffs.original-revision")}}{{{ end }}}
		</option>
		{{{ end }}}
	</select>

	<hr />

	<ul class="posts-list diffs list-unstyled"></ul>

	{{{ if editable }}}
	<button class="btn btn-primary" data-action="restore">{{tx("topic:diffs.restore")}}</button>
	{{{ end }}}
	{{{ if deletable }}}
	<button class="btn btn-danger" data-action="delete">{{tx("topic:diffs.delete")}}</button>
	{{{ end }}}
	{{{ if editable }}}
	<p class="form-text">{{tx("topic:diffs.restore-description")}}</p>
	{{{ end }}}
</div>
{{{ end }}}
