<!-- IMPORT emails/partials/header.tpl -->

<!-- Email Body : BEGIN -->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px;">
	<!-- 1 Column Text + Button : BEGIN -->
	<tr>
		<td bgcolor="#ffffff">
			<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
				<tr>
					<td style="padding: 40px 40px 6px 40px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; font-size: 15px; line-height: 20px; color: #555555;">
						<h1 style="margin: 0; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; font-size: 24px; line-height: 27px; color: #333333; font-weight: normal;">[[email:greeting_with_name, {username}]]</h1>
					</td>
				</tr>
				<tr>
					<td style="padding: 0px 40px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; font-size: 15px; line-height: 20px; color: #555555;">
						<h1 style="margin: 0 0 10px 0; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; font-size: 18px; line-height: 21px; color: #aaaaaa; font-weight: normal;">[[email:banned.text1, {username}, {site_title}]]</h1>
					</td>
				</tr>
				<!-- IF reason -->
				<tr>
					<td style="padding: 20px 40px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; font-size: 15px; line-height: 20px; color: #555555;">
						<p style="margin: 0;">
							[[email:banned.text3]]
						</p>
						<p style="margin: 0; padding: 6px 0px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; font-size: 13px; line-height: 26px; color: #666666;">
							{reason}
						</p>
					</td>
				</tr>
				<!-- ENDIF reason -->
				<!-- IF until -->
				<tr>
					<td style="padding: 20px 40px; font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol; font-size: 15px; line-height: 20px; color: #555555;">
						<p style="margin: 0;">
							[[email:banned.text2, {until}]]
						</p>
					</td>
				</tr>
				<!-- ENDIF until -->
			</table>
		</td>
	</tr>
	<!-- 1 Column Text + Button : END -->

</table>
<!-- Email Body : END -->

<!-- IMPORT emails/partials/footer.tpl -->
