{{{ each groups }}}
<div class="col-xl-4 col-lg-6 col-sm-12 mb-3" component="groups/summary" data-slug="{./slug}">
	<div class="card h-100 group-hover-bg border p-1">
		<a href="{config.relative_path}/groups/{./slug}" class="card-header border-0 rounded-1 pointer d-block list-cover" style="{{{ if ./cover:thumb:url }}}background-image: url({./cover:thumb:url});background-size: cover; min-height: 125px; background-position: {./cover:position}{{{ end }}}" aria-label="{tx("aria:group-page-link-for", txEscape(./displayName))}"></a>
		<a href="{config.relative_path}/groups/{./slug}" class="d-block h-100 text-reset text-decoration-none">
			<div class="card-body d-flex flex-column gap-2 h-100 pb-2">
				<div class="d-flex">
					<div class="flex-grow-1 fs-6 fw-semibold text-capitalize">{generateGroupDisplayName(@value)}</div>
				</div>
				<div class="text-sm line-clamp-3 mb-last-0">{{stripTags(./descriptionParsed)}}</div>
				<div class="d-flex flex-wrap gap-1 align-items-center mt-auto pt-2">
					<div class="badge border border-gray-300 fw-normal text-body"><i class="text-secondary fa-solid fa-users"></i> {formattedNumber(./memberCount)}</div>
					<span class="badge border border-gray-300 fw-normal text-body">
						{{{ if ./private }}}{{tx("groups:details.private")}}{{{ else }}}{{tx("groups:details.public")}}{{{ end }}}
					</span>
					{{tx("groups:details.created", "timeago badge border border-gray-300 fw-normal text-body", ./createtimeISO)}}
				</div>
			</div>
		</a>
	</div>
</div>
{{{ end }}}