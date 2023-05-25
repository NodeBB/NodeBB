<div class="category acp-page-container" data-cid="{category.cid}">
	<div component="settings/main/header" class="row border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center">
		<div class="col-8 px-0 justify-content-between d-flex ">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/categories:edit-category]]</h4>
			<!-- IMPORT admin/partials/category/selector-dropdown-right.tpl -->
		</div>
		<div class="col-4 px-0 px-md-3">
			<button id="save" class="btn btn-primary btn-sm btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>

	<div class="row m-0">
		<div class="col-8 px-0" id="category-settings">
			<div class="category-settings-form">
				<div class="mb-3">
					<label class="form-label" for="cid-{category.cid}-name">
						[[admin/manage/categories:name]]
					</label>
					<input id="cid-{category.cid}-name" type="text" class="form-control" data-name="name" value="{category.name}" />
				</div>

				<div class="mb-3">
					<label class="form-label" for="cid-{category.cid}-description">
						[[admin/manage/categories:description]]
					</label>
					<textarea id="cid-{category.cid}-description" data-name="description" class="form-control category_description description" rows="4" />{category.description}</textarea>
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label" for="cid-{category.cid}-parentCid">[[admin/manage/categories:parent-category]]</label>
					<div class="d-grid">
						<div class="d-flex gap-1 {{{ if !category.parent.name }}}hide{{{ end }}}">
							<button type="button" class="btn btn-light" data-action="changeParent" data-parentCid="{category.parent.cid}"><i class="fa {category.parent.icon}"></i> {category.parent.name}</button>
							<button type="button" class="btn btn-light" data-action="removeParent" data-parentCid="{category.parent.cid}"><i class="fa fa-times text-danger"></i></button>
						</div>
						<button type="button" class="btn btn-outline-secondary {{{ if category.parent.name }}}hide{{{ end }}}" data-action="setParent">
							<i class="fa fa-sitemap"></i>
							[[admin/manage/categories:parent-category-none]]
						</button>
					</div>
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label" for="cid-{category.cid}-numRecentReplies">
						[[admin/manage/categories:num-recent-replies]]
					</label>
					<input id="cid-{category.cid}-numRecentReplies" type="text" class="form-control" placeholder="1" data-name="numRecentReplies" value="{category.numRecentReplies}" style="max-width: 64px;"/>
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label" for="cid-subcategories-per-page">
						[[admin/manage/categories:subcategories-per-page]]
					</label>
					<input id="cid-subcategories-per-page" type="text" class="form-control" data-name="subCategoriesPerPage" value="{category.subCategoriesPerPage}" style="max-width: 64px;"/>
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label" for="cid-subcategories-per-page">
						[[admin/settings/tags:tags-per-topic]]
					</label>
					<div class="d-flex gap-3 align-items-center">
						<div class="d-flex gap-1 align-items-center">
							<label for="cid-min-tags">[[admin/settings/tags:min]]</label>
							<input id="cid-min-tags" type="text" class="form-control" data-name="minTags" value="{category.minTags}" style="max-width: 64px;"/>
						</div>
						<div class="d-flex gap-1 align-items-center">
							<label for="cid-max-tags">[[admin/settings/tags:max]]</label>
							<input id="cid-max-tags" type="text" class="form-control" data-name="maxTags" value="{category.maxTags}" style="max-width: 64px;"/>
						</div>
					</div>
				</div>

				<div class="mb-3 d-flex flex-column">
					<label class="form-label" for="cid-{category.cid}-link">
						[[admin/manage/categories:ext-link]]
					</label>
					<input id="cid-{category.cid}-link" type="text" class="form-control" placeholder="http://domain.com" data-name="link" value="{category.link}" />
				</div>

				<div class="mb-3">
					<label class="form-label" for="tag-whitelist">[[admin/manage/categories:tag-whitelist]]</label>
					<input id="tag-whitelist" type="text" class="form-control" data-name="tagWhitelist" value="" />
				</div>

				<div class="mb-3">
					<div class="form-check form-switch">
						<input type="checkbox" class="form-check-input" id="cid-{category.cid}-isSection" data-name="isSection" {{{ if category.isSection }}}checked{{{ end }}} />
						<label class="form-check-label">[[admin/manage/categories:is-section]]</label>
					</div>
				</div>

				{{{ if postQueueEnabled }}}
				<div class="mb-3">
					<div class="form-check form-switch">
						<input type="checkbox" class="form-check-input" data-name="postQueue" {{{ if category.postQueue }}}checked{{{ end }}} />
						<label class="form-check-label">[[admin/manage/categories:post-queue]]</label>
					</div>
				</div>
				{{{ end }}}
				<hr/>

				<div class="mb-3 d-flex flex-column">
					<label class="form-label" for="category-image">
						[[admin/manage/categories:category-image]]
					</label>
					<div class="d-flex gap-2 align-items-center">
						<div component="category/preview" class="category-preview rounded-1 d-flex align-items-center justify-content-center pointer"
						data-bs-toggle="tooltip" title="[[admin/manage/categories:select-icon]]"
						style="
							{{{ if category.backgroundImage }}}background-image: url({category.backgroundImage});{{{ end }}}
							{{{ if category.bgColor }}}background-color: {category.bgColor};{{{ end }}}
							{{{ if category.imageClass }}}background-size: {category.imageClass};{{{ end }}}
							color: {category.color};
							width: 40px; height: 40px; font-size: 20px;
						">
							<div class="icon">
								<i data-name="icon" value="{category.icon}" class="fa {category.icon}"></i>
							</div>
						</div>

						<input id="category-image" type="text" class="form-control flex-1" placeholder="[[admin/manage/categories:category-image]]" data-name="backgroundImage" value="{category.backgroundImage}" />
						<button type="button" data-cid="{category.cid}" class="btn btn-light upload-button">[[admin/manage/categories:upload]]</button>
						<button class="btn btn-light delete-image">
							<i data-name="icon" value="fa-times" class="fa fa-trash text-danger"></i>
						</button>
					</div>
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label align-self-center" for="cid-{category.cid}-bgColor">
						[[admin/manage/categories:bg-color]]
					</label>
					<!-- added this to match the height of other blocks -->
					<input type="text" class="form-control invisible" style="width: 0px;">
					<input type="color" id="cid-{category.cid}-bgColor" placeholder="#0059b2" data-name="bgColor" value="{category.bgColor}" class="form-control category_bgColor p-1 h-auto align-self-stretch" style="max-width: 64px;" />
				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label align-self-center" for="cid-{category.cid}-color">
						[[admin/manage/categories:text-color]]
					</label>
					<!-- added this to match the height of other blocks -->
					<input type="text" class="form-control invisible" style="width: 0px;">
					<input type="color" id="cid-{category.cid}-color" placeholder="#ffffff" data-name="color" value="{category.color}" class="form-control category_color p-1 h-auto align-self-stretch" style="max-width: 64px;" />

				</div>

				<div class="mb-3 d-flex justify-content-between align-items-center gap-2">
					<label class="form-label" for="cid-{category.cid}-imageClass">
						[[admin/manage/categories:bg-image-size]]
					</label>
					<select id="cid-{category.cid}-imageClass" class="form-select w-auto" data-name="imageClass" data-value="{category.imageClass}">
						<option value="auto">auto</option>
						<option value="cover">cover</option>
						<option value="contain">contain</option>
					</select>
				</div>

				<div class="mb-3 d-flex flex-column justify-content-between">
					<label class="form-label" for="cid-{category.cid}-class">
						[[admin/manage/categories:custom-class]]
					</label>
					<input list="customClasses" id="cid-{category.cid}-class" type="text" class="form-control" placeholder="{{{ if customClasses.length }}}{{{ each customClasses }}}{{{ if @first }}}{@value}{{{ end }}}{{{ end }}}{{{ else }}}col-md-6 col-6{{{ end }}}" data-name="class" value="{category.class}" />
					<datalist id="customClasses">
						{{{ each customClasses }}}
						<option>{@value}</option>
						{{{ end }}}
					</datalist>
				</div>
			</div>
		</div>

		<div class="col-4 options acp-sidebar">
			<div class="card">
				<div class="card-body">


					<hr/>
					<div class="d-grid gap-2">
						<a href="{config.relative_path}/admin/manage/privileges/{category.cid}" class="btn btn-info >
							<i class="fa fa-gear"></i> [[admin/manage/privileges:edit-privileges]]
						</a>
						<a href="{config.relative_path}/category/{category.cid}" class="btn btn-info >
							<i class="fa fa-eye"></i> [[admin/manage/categories:view-category]]
						</a>
						<button class="btn btn-info copy-settings">
							<i class="fa fa-files-o"></i> [[admin/manage/categories:copy-settings]]
						</button>
					</div>
					<hr />
					<div class="d-grid gap-2">
						<button data-action="toggle" data-disabled="{category.disabled}" class="btn btn-sm btn-block {{{ if category.disabled }}}btn-primary{{{ else }}}btn-danger{{{ end }}}">
							{{{ if category.disabled }}}
							[[admin/manage/categories:enable]]
							{{{ else }}}
							[[admin/manage/categories:disable]]
							{{{ end }}}
						</button>
						<button class="btn btn-sm btn-danger btn-block purge">
							<i class="fa fa-eraser"></i> [[admin/manage/categories:purge]]
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>


