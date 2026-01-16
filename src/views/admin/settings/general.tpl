<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="site-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/general:site-settings]]
				</h5>
				<form>
					<div class="mb-3">
						<label class="form-label" for="site-title">[[admin/settings/general:title]]</label>
						<input id="site-title" class="form-control" type="text" placeholder="[[admin/settings/general:title.name]]" data-field="title" />
					</div>

					<div class="form-check form-switch mb-3">
						<input type="checkbox" class="form-check-input" id="showSiteTitle" data-field="showSiteTitle" name="showSiteTitle" />
						<label for="showSiteTitle" class="form-check-label">[[admin/settings/general:title.show-in-header]]</label>
					</div>

					<div class="mb-3">
						<label class="form-label" for="title:short">[[admin/settings/general:title.short]]</label>
						<input id="title:short" type="text" class="form-control" data-field="title:short" />
						<p class="form-text">[[admin/settings/general:title.short-placeholder]]</p>
					</div>

					<div class="mb-3">
						<label class="form-label" for="title:url">[[admin/settings/general:title.url]]</label>
						<input id ="title:url" type="text" class="form-control" data-field="title:url" />
						<p class="form-text">
							[[admin/settings/general:title.url-help]]
						</p>
					</div>

					<div class="mb-3">
						<label class="form-label" for="browserTitle">[[admin/settings/general:browser-title]]</label>
						<input id="browserTitle" class="form-control" type="text" data-field="browserTitle" />
						<p class="form-text">
							[[admin/settings/general:browser-title-help]]
						</p>
					</div>
					<div class="mb-3">
						<label class="form-label" for="titleLayout">[[admin/settings/general:title-layout]]</label>
						<input id="titleLayout" class="form-control" type="text" data-field="titleLayout" />
						<p class="form-text">
							[[admin/settings/general:title-layout-help]]
						</p>
					</div>
					<div class="mb-3">
						<label class="form-label" for="description">[[admin/settings/general:description]]</label>
						<input id="description" type="text" class="form-control" data-field="description" />
						<p class="form-text">
							[[admin/settings/general:description.placeholder]]
						</p>
					</div>
					<div class="mb-3">
						<label class="form-label" for="keywords">[[admin/settings/general:keywords]]</label>
						<input id="keywords" type="text" class="form-control" data-field="keywords" data-field-type="tagsinput" />
						<p class="form-text">[[admin/settings/general:keywords-placeholder]]</p>
					</div>

					<div class="mb-3">
						<div class="mb-2">
							<label class="form-label" for="language">[[admin/settings/general:default-language]]</label>
							<select id="language" data-field="defaultLang" class="form-select">
								{{{ each languages }}}
								<option value="{./code}" {{{ if ./selected }}}selected{{{ end }}}>{./name} ({./code})</option>
								{{{ end }}}
							</select>
						</div>
						<p class="form-text">
							[[admin/settings/general:default-language-help]]
						</p>

						<div class="">
							<div class="form-check form-switch">
								<input id="autoDetectLang" class="form-check-input" type="checkbox" data-field="autoDetectLang" {{{ if autoDetectLang }}}checked{{{ end }}}/>
								<label for="autoDetectLang" class="form-check-label">[[admin/settings/general:auto-detect]]</label>
							</div>
						</div>
					</div>
				</form>
			</div>

			<hr/>

			<div id="logo-and-icons" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/general:logo-and-icons]]</h5>
				<div class="mb-3">
					<label class="form-label" for="logoUrl">[[admin/settings/general:logo.image]]</label>
					<div class="d-flex gap-1">
						<input id="logoUrl" type="text" class="form-control" placeholder="[[admin/settings/general:logo.image-placeholder]]" data-field="brand:logo" />

						<input data-action="upload" data-target="logoUrl" data-route="{config.relative_path}/api/admin/uploadlogo" type="button" class="btn btn-light" value="[[admin/settings/general:logo.upload]]" />
						<button data-action="removeLogo" type="button" class="btn btn-light"><i class="fa fa-trash text-danger"></i></button>
					</div>
				</div>

				<div class="mb-3">
					<label class="form-label" for="brand:logo:url">[[admin/settings/general:logo.url]]</label>
					<input id ="brand:logo:url" type="text" class="form-control" data-field="brand:logo:url" />
					<p class="form-text">
						[[admin/settings/general:logo.url-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="brand:logo:alt">[[admin/settings/general:logo.alt-text]]</label>
					<input id ="brand:logo:alt" type="text" class="form-control" data-field="brand:logo:alt" />
					<p class="form-text">[[admin/settings/general:log.alt-text-placeholder]]</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="og_image">og:image</label>
					<div class="d-flex gap-1">
						<input id="og_image" type="text" class="form-control" placeholder="" data-field="og:image" />

						<input data-action="upload" data-target="og_image" data-route="{config.relative_path}/api/admin/uploadOgImage" type="button" class="btn btn-light" value="[[admin/settings/general:logo.upload]]" />
						<button data-action="removeOgImage" type="button" class="btn btn-light"><i class="fa fa-trash text-danger"></i></button>
					</div>
				</div>

				<div class="mb-3">
					<label class="form-label" for="faviconUrl">[[admin/settings/general:favicon]]</label>
					<div class="d-flex gap-1">
						<input id="faviconUrl" type="text" class="form-control" placeholder="favicon.ico" data-field="brand:favicon" />

						<input data-action="upload" data-target="faviconUrl" data-route="{config.relative_path}/api/admin/uploadfavicon" data-help="0" type="button" class="btn btn-light" value="[[admin/settings/general:favicon.upload]]" />
						<button data-action="removeFavicon" type="button" class="btn btn-light"><i class="fa fa-trash text-danger"></i></button>
					</div>
				</div>

				<div class="mb-3">
					<label class="form-label" for="touchIconUrl">[[admin/settings/general:touch-icon]]</label>
					<div class="d-flex gap-1">
						<input id="touchIconUrl" type="text" class="form-control" data-field="brand:touchIcon" />
						<input data-action="upload" data-target="touchIconUrl" data-route="{config.relative_path}/api/admin/uploadTouchIcon" type="button" class="btn btn-light" value="[[admin/settings/general:touch-icon.upload]]" />
						<button data-action="removeTouchIcon" type="button" class="btn btn-light"><i class="fa fa-trash text-danger"></i></button>
					</div>
					<p class="form-text">
						[[admin/settings/general:touch-icon.help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="maskableIconUrl">[[admin/settings/general:maskable-icon]]</label>
					<div class="d-flex gap-1">
						<input id="maskableIconUrl" type="text" class="form-control" data-field="brand:maskableIcon" />

						<input data-action="upload" data-target="maskableIconUrl" data-route="{config.relative_path}/api/admin/uploadMaskableIcon" type="button" class="btn btn-light" value="[[admin/settings/general:touch-icon.upload]]" />
						<button data-action="removeMaskableIcon" type="button" class="btn btn-light"><i class="fa fa-trash text-danger"></i></button>
					</div>
					<p class="form-text">
						[[admin/settings/general:maskable-icon.help]]
					</p>
				</div>
			</div>

			<hr/>

			<div id="home-page" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/general:home-page]]</h5>

				<div class="">
					<p>
						[[admin/settings/general:home-page-description]]
					</p>
					<form class="row">
						<div class="col-sm-12">
							<div class="mb-3">
								<label class="form-label" for="homePageRoute">[[admin/settings/general:home-page-route]]</label>
								<select id="homePageRoute" class="form-select" data-field="homePageRoute">
									{{{ each routes }}}
									<option value="{./route}">{./name}</option>
									{{{ end }}}
								</select>
							</div>
							<div id="homePageCustom" class="mb-3" style="display: none;">
								<label class="form-label" for="homePageCustomInput">[[admin/settings/general:custom-route]]</label>
								<input id="homePageCustomInput" type="text" class="form-control" data-field="homePageCustom"/>
								<p class="form-text">[[user:custom-route-help]]</p>
							</div>

							<div class="form-check form-switch mb-3">
								<input class="form-check-input" type="checkbox" id="allowUserHomePage" data-field="allowUserHomePage">
								<label for="allowUserHomePage" class="form-check-label">[[admin/settings/general:allow-user-home-pages]]</label>
							</div>
							<div>
								<label class="form-label" for="homePageTitle">[[admin/settings/general:home-page-title]]</label>
								<input id="homePageTitle" class="form-control" type="text" data-field="homePageTitle">
							</div>
						</div>
					</form>
				</div>
			</div>

			<hr/>

			<div id="search-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/general:search]]</h5>

				<div class="mb-3 d-flex justify-content-between align-items-center">
					<label class="form-label" for="searchDefaultIn">[[admin/settings/general:search-default-in]]</label>
					<select id="searchDefaultIn" class="form-select w-auto" data-field="searchDefaultIn">
						<option value="titlesposts">[[search:in-titles-posts]]</option>
						<option value="titles">[[search:in-titles]]</option>
						<option value="posts">[[search:in-posts]]</option>
						<option value="categories">[[search:in-categories]]</option>
						<option value="users">[[search:in-users]]</option>
						<option value="tags">[[search:in-tags]]</option>
					</select>
				</div>
				<div class="mb-3 d-flex justify-content-between align-items-center">
					<label class="form-label" for="searchDefaultInQuick">[[admin/settings/general:search-default-in-quick]]</label>
					<select id="searchDefaultInQuick" class="form-select w-auto" data-field="searchDefaultInQuick">
						<option value="titlesposts">[[search:in-titles-posts]]</option>
						<option value="titles">[[search:in-titles]]</option>
						<option value="posts">[[search:in-posts]]</option>
					</select>
				</div>
				<div class="mb-3 d-flex justify-content-between align-items-center">
					<label class="form-label" for="post-sort-by">[[admin/settings/general:search-default-sort-by]]</label>
					<select id="post-sort-by" class="form-select w-auto" data-field="searchDefaultSortBy">
						<option value="relevance">[[search:relevance]]</option>
						<option value="timestamp">[[search:post-time]]</option>
						<option value="votes">[[search:votes]]</option>
						<option value="topic.lastposttime">[[search:last-reply-time]]</option>
						<option value="topic.title">[[search:topic-title]]</option>
						<option value="topic.postcount">[[search:number-of-replies]]</option>
						<option value="topic.viewcount">[[search:number-of-views]]</option>
						<option value="topic.votes">[[search:topic-votes]]</option>
						<option value="topic.timestamp">[[search:topic-start-date]]</option>
						<option value="user.username">[[search:username]]</option>
						<option value="category.name">[[search:category]]</option>
					</select>
				</div>
				<div class="mb-3 d-flex justify-content-between align-items-center">
					<label class="form-label" for="userSearchResultsPerPage">[[admin/settings/user:user-search-results-per-page]]</label>
					<input id="userSearchResultsPerPage" type="text" class="form-control" value="24" data-field="userSearchResultsPerPage" style="max-width: 64px;">
				</div>
			</div>

			<hr/>

			<div id="outgoing-links" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/general:outgoing-links]]</h5>

				<form>
					<div class="form-check form-switch mb-3">
						<input type="checkbox" class="form-check-input" id="useOutgoingLinksPage" data-field="useOutgoingLinksPage">
						<label for="useOutgoingLinksPage" class="form-check-label">[[admin/settings/general:outgoing-links.warning-page]]</label>
					</div>

					<div class="mb-3">
						<label class="form-label" for="outgoingLinks:whitelist">[[admin/settings/general:outgoing-links.whitelist]]</label>
						<input id="outgoingLinks:whitelist" type="text" class="form-control" data-field="outgoingLinks:whitelist" data-field-type="tagsinput" />
					</div>
				</form>

			</div>

			<hr/>

			<div id="site-colors" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/general:site-colors]]</h5>

				<div class="mb-3">
					<label class="form-label" for="themeColor">[[admin/settings/general:theme-color]]</label>
					<input id="themeColor" type="text" class="form-control" placeholder="#ffffff" data-field="themeColor" />
				</div>
				<div class="mb-3">
					<label class="form-label" for="backgroundColor">[[admin/settings/general:background-color]]</label>
					<input id="backgroundColor" type="text" class="form-control" placeholder="#ffffff" data-field="backgroundColor" />
					<p class="form-text">
						[[admin/settings/general:background-color-help]]
					</p>
				</div>
			</div>

			<hr/>

			<div id="topic-tools" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/general:topic-tools]]</h5>

				<div class="mb-3">
					<label class="form-label" for="undoTimeout">[[admin/settings/general:undo-timeout]]</label>
					<input id="undoTimeout" type="text" class="form-control" data-field="undoTimeout" />
					<p class="form-text">
						[[admin/settings/general:undo-timeout-help]]
					</p>
				</div>
			</div>

			<hr/>

			<div id="post-sharing" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/general:post-sharing]]</h5>
				<div class="mb-3">
					<div class="form-group" id="postSharingNetworks">
						{{{ each postSharing }}}
						<div class="form-check form-switch mb-3">
							<input type="checkbox" class="form-check-input" id="{./id}" data-field="post-sharing-{./id}" name="{./id}" {{{ if ./activated }}}checked{{{ end }}} />
							<label for="{./id}" class="form-check-label">
								<i class="fa-fw {./class}"></i> {./name}
							</label>
						</div>
						{{{ end }}}
						<p class="form-text">[[admin/settings/general:info-plugins-additional]]</p>
					</div>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>