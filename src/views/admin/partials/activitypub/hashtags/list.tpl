{{{ each hashtags }}}
<tr data-tag="{./tag}">
	<td><code>#{{./tag}}</code></td>
	<td>
		<span class="badge bg-{./stateClass}" title="{tx("admin/settings/activitypub:hashtags.state-{./state}")}">
			{tx("admin/settings/activitypub:hashtags.state-{./state}")}
		</span>
	</td>
	<td><a href="#" data-action="hashtags.remove" data-tag="{./tag}"><i class="fa fa-trash link-danger"></i></a></td>
</tr>
{{{ end }}}
