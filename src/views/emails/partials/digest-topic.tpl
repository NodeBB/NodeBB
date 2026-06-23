<li style="text-decoration: none; list-style-type: none; padding-bottom: 0.5em;">
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
		<tr>
			<td style="padding: 6px 16px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; width: 32px; vertical-align: middle;">{{renderDigestAvatar(@value)}}</td>
			<td style="padding: 6px 16px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; line-height: 16px; color: #333333;">
				<p style="margin: 0;"><a style="text-decoration:none !important; text-decoration:none; color: #333333;" href="{url}/topic/{./slug}"><strong>{./title}</strong></a></p>
				<p style="margin: 0; font-size: 12px;"><a style="text-decoration:none !important; text-decoration:none; color: #aaaaaa; line-height: 16px;" href="{url}/uid/{./teaser.user.uid}"><strong>{./teaser.user.displayname}</strong></a></p>
			</td>
		</tr>
		<tr>
			<td colspan="2" style="padding: 8px 16px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; line-height: 16px; color: #333333;">
				<p style="margin: 0; padding: 6px 0px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; font-size: 13px; line-height: 26px; color: #666666;">{./teaser.content}</p>
				<p style="margin: 0; padding: 6px 0px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; line-height: 16px;">
					<a style="text-decoration:none !important; text-decoration:none; text-transform: capitalize; color: #666666; line-height: 16px;" href="{url}/topic/{./slug}">
						<small><strong><span style="color: #aaaaaa;">&rsaquo;</span> [[global:read-more]]</strong></small>
					</a>
				</p>
			</td>
		</tr>
	</table>
</li>
{{{ if !@last }}}
<li style="text-decoration: none; list-style-type: none; margin: 0px 64px 16px 64px; border-bottom: 1px solid #dddddd"></li>
{{{ end }}}