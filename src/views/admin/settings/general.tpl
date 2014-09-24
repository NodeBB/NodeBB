	<div class="tab-pane active" id="general">
		<div class="alert alert-warning">
			<form>
				<label>Site Title</label>
				<input class="form-control" type="text" placeholder="Your Community Name" data-field="title" />

				<div class="checkbox">
					<label for="showSiteTitle">
						<input type="checkbox" id="showSiteTitle" data-field="showSiteTitle" name="showSiteTitle" /> Show Site Title in Header
					</label>
				</div>

				<label>Browser Title</label>
				<input class="form-control" type="text" placeholder="Browser Title" data-field="browserTitle" />
				<p class="help-block">
					If no browser title is specified, the site title will be used
				</p>

				<label>Site Description</label>
				<input type="text" class="form-control" placeholder="A short description about your community" data-field="description" /><br />

				<label>Site Keywords</label>
				<input type="text" class="form-control" placeholder="Keywords describing your community, comma-seperated" data-field="keywords" /><br />

				<label>Site Logo</label>
				<input id="logoUrl" type="text" class="form-control" placeholder="Path to a logo to display on forum header" data-field="brand:logo" /><br />
				<input data-action="upload" data-target="logoUrl" data-route="{relative_path}/admin/uploadlogo" type="button" class="btn btn-default" value="Upload Logo"></input> <br /> <br/>

				<label>Favicon</label><br />
				<input id="faviconUrl" type="text" class="form-control" placeholder="favicon.ico" data-field="brand:favicon" /><br />
				<input data-action="upload" data-target="faviconUrl" data-route="{relative_path}/admin/uploadfavicon" type="button" class="btn btn-default" value="Upload"></input> <br /> <br/>

				<hr/>
				<div class="checkbox">
					<label>
						<input type="checkbox" data-field="allowGuestSearching"> <strong>Allow guests to search without logging in</strong>
					</label>
				</div>
				<div class="checkbox">
					<label>
						<input type="checkbox" data-field="useOutgoingLinksPage"> <strong>Use Outgoing Links Warning Page</strong>
					</label>
				</div>
				<div class="checkbox">
					<label>
						<input type="checkbox" data-field="disableSocialButtons"> <strong>Disable social buttons</strong>
					</label>
				</div>
			</form>
		</div>
	</div>