<div class="category" data-cid="{category.cid}">
	<div class="row mb-3">
		<div class="d-flex col-12 justify-content-end">
			<!-- IMPORT admin/partials/category/selector-dropdown-right.tpl -->
		</div>
	</div>

	<div class="row">
		<div class="col-md-9" id="category-settings">
			<div class="category-settings-form">
				<div class="mb-3">
					<label class="form-label" for="cid-{category.cid}-name">
						[[admin/manage/categories:name]]
					</label>
					<input id="cid-{category.cid}-name" type="text" class="form-control" placeholder="[[admin/manage/categories:name]]" data-name="name" value="{category.name}" />
				</div>

				<div class="mb-3">
					<label class="form-label" for="cid-{category.cid}-description">
						[[admin/manage/categories:description]]
					</label>
					<textarea id="cid-{category.cid}-description" data-name="description" placeholder="[[admin/manage/categories:description]]" class="form-control category_description description" />{category.description}</textarea>
				</div>

				<div class="row mb-3">
					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-{category.cid}-bgColor">
								[[admin/manage/categories:bg-color]]
							</label>
							<input type="color" id="cid-{category.cid}-bgColor" placeholder="#0059b2" data-name="bgColor" value="{category.bgColor}" class="form-control category_bgColor" />
						</div>
					</div>

					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-{category.cid}-color">
								[[admin/manage/categories:text-color]]
							</label>
							<input type="color" id="cid-{category.cid}-color" placeholder="#ffffff" data-name="color" value="{category.color}" class="form-control category_color" />
						</div>
					</div>

					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-{category.cid}-imageClass">
								[[admin/manage/categories:bg-image-size]]
							</label>
							<select id="cid-{category.cid}-imageClass" class="form-select" data-name="imageClass" data-value="{category.imageClass}">
								<option value="auto">auto</option>
								<option value="cover">cover</option>
								<option value="contain">contain</option>
							</select>
						</div>
					</div>
				</div>

				<div class="row mb-3">
					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-{category.cid}-class">
								[[admin/manage/categories:custom-class]]
							</label>
							<input list="customClasses" id="cid-{category.cid}-class" type="text" class="form-control" placeholder="<!-- IF customClasses.length --><!-- BEGIN customClasses --><!-- IF @first -->{@value}<!-- ENDIF --><!-- END --><!-- ELSE -->col-md-6 col-6<!-- ENDIF -->" data-name="class" value="{category.class}" />
							<datalist id="customClasses">
								<!-- BEGIN customClasses -->
								<option>{@value}</option>
								<!-- END customClasses -->
							</datalist>
						</div>
					</div>
					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-{category.cid}-numRecentReplies">
								[[admin/manage/categories:num-recent-replies]]
							</label>
							<input id="cid-{category.cid}-numRecentReplies" type="text" class="form-control" placeholder="2" data-name="numRecentReplies" value="{category.numRecentReplies}" />
						</div>
					</div>
					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-{category.cid}-link">
								[[admin/manage/categories:ext-link]]
							</label>
							<input id="cid-{category.cid}-link" type="text" class="form-control" placeholder="http://domain.com" data-name="link" value="{category.link}" />
						</div>
					</div>
				</div>

				<div class="row mb-3">
					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-subcategories-per-page">
								[[admin/manage/categories:subcategories-per-page]]
							</label>
							<input id="cid-subcategories-per-page" type="text" class="form-control" data-name="subCategoriesPerPage" value="{category.subCategoriesPerPage}" />
						</div>
					</div>
					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-min-tags">
								[[admin/settings/tags:min-per-topic]]
							</label>
							<input id="cid-min-tags" type="text" class="form-control" data-name="minTags" value="{category.minTags}" />
						</div>
					</div>
					<div class="col-sm-4 col-12">
						<div class="form-group">
							<label class="form-label" for="cid-max-tags">
								[[admin/settings/tags:max-per-topic]]
							</label>
							<input id="cid-max-tags" type="text" class="form-control" data-name="maxTags" value="{category.maxTags}" />
						</div>
					</div>
				</div>
				<div class="row mb-3">
					<div class="col-lg-12">
						<div class="form-group">
							<label class="form-label" for="tag-whitelist">[[admin/manage/categories:tag-whitelist]]</label>
							<input id="tag-whitelist" type="text" class="form-control" data-name="tagWhitelist" value="" />
						</div>
					</div>
				</div>
				<div class="row">
					<div class="col-lg-6">
						<div class="form-group">
							<div class="form-check form-switch">
								<input type="checkbox" class="form-check-input" id="cid-{category.cid}-isSection" data-name="isSection" <!-- IF category.isSection -->checked<!-- ENDIF category.isSection --> />
								<label class="form-check-label">[[admin/manage/categories:is-section]]</label>
							</div>
						</div>
					</div>
					{{{ if postQueueEnabled }}}
					<div class="col-lg-6">
						<div class="form-group">
							<div class="form-check form-switch">
								<input type="checkbox" class="form-check-input" data-name="postQueue" {{{ if category.postQueue }}}checked{{{ end }}} />
								<label class="form-check-label">[[admin/manage/categories:post-queue]]</label>
							</div>
						</div>
					</div>
					{{{ end }}}
				</div>
			</div>
		</div>

		<div class="col-md-3 options acp-sidebar">
			<div class="card">
				<div class="card-body">
					<div class="category-preview" style="
						<!-- IF category.backgroundImage -->background-image: url({category.backgroundImage});<!-- ENDIF category.backgroundImage -->
						<!-- IF category.bgColor -->background-color: {category.bgColor};<!-- ENDIF category.bgColor -->
						<!-- IF category.imageClass -->background-size: {category.imageClass};<!-- ENDIF category.imageClass -->
						color: {category.color};
					">
						<div class="icon">
							<i data-name="icon" value="{category.icon}" class="fa {category.icon} fa-2x"></i>
						</div>
					</div>
					<div class="d-grid gap-2 mb-3">
						<div class="btn-group">
							<button type="button" data-cid="{category.cid}" class="btn btn-outline-secondary upload-button">
								<i class="fa fa-upload"></i>
								[[admin/manage/categories:upload-image]]
							</button>
						</div>
						<!-- IF category.backgroundImage -->
						<div class="btn-group">
							<button class="btn btn-warning delete-image">
								<i data-name="icon" value="fa-times" class="fa fa-times"></i>
								[[admin/manage/categories:delete-image]]
							</button>
						</div>
						<!-- ENDIF category.backgroundImage -->
					</div>


					<div class="mb-3">
						<label class="form-label" for="category-image">
							[[admin/manage/categories:category-image]]
						</label>
						<input id="category-image" type="text" class="form-control" placeholder="[[admin/manage/categories:category-image]]" data-name="backgroundImage" value="{category.backgroundImage}" />
					</div>

					<div class="mb-3">
						<label class="form-label" for="cid-{category.cid}-parentCid">[[admin/manage/categories:parent-category]]</label>
						<div class="d-grid">
							<div class="btn-group <!-- IF !category.parent.name -->hide<!-- ENDIF !category.parent.name -->">
								<button type="button" class="btn btn-outline-secondary" data-action="changeParent" data-parentCid="{category.parent.cid}"><i class="fa {category.parent.icon}"></i> {category.parent.name}</button>
								<button type="button" class="btn btn-warning" data-action="removeParent" data-parentCid="{category.parent.cid}"><i class="fa fa-times"></i></button>
							</div>
							<button type="button" class="btn btn-outline-secondary btn-block <!-- IF category.parent.name -->hide<!-- ENDIF category.parent.name -->" data-action="setParent">
								<i class="fa fa-sitemap"></i>
								[[admin/manage/categories:parent-category-none]]
							</button>
						</div>
					</div>

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
						<button data-action="toggle" data-disabled="{category.disabled}" class="btn btn-sm btn-block <!-- IF category.disabled -->btn-primary<!-- ELSE -->btn-danger<!-- ENDIF category.disabled -->">
							<!-- IF category.disabled -->
							[[admin/manage/categories:enable]]
							<!-- ELSE -->
							[[admin/manage/categories:disable]]
							<!-- ENDIF category.disabled -->
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

<!-- IMPORT admin/partials/save_button.tpl -->
