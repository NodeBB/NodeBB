<div class="row">
	<form role="form" class="category" data-cid="{category.cid}">
		<div class="col-md-9">
			<div class="panel panel-default">
				<div class="panel-heading"><i class="fa fa-folder"></i> Categories</div>
				<div class="panel-body">
					<div class="pull-right text-right">
						<div class="form-group">
							<div class="dropdown">
								<button type="button" class="btn btn-default" data-toggle="dropdown"><i class="fa fa-cogs"></i> Options</button>
								<ul class="dropdown-menu" role="menu">
									<li class="permissions"><a href="#"><i class="fa fa-ban"></i> Access Control</a></li>
									<hr />
									
								</ul>
							</div>
						</div>
					</div>
					
					<h3 data-edit-target="#cid-{category.cid}-name"><span>{category.name}</span> <small><i class="fa fa-edit"></i></small></h3>
					<input id="cid-{category.cid}-name" type="text" class="form-control hide" placeholder="Category Name" data-name="name" value="{category.name}" />
					<h4 data-edit-target="#cid-{category.cid}-description"><span>{category.description}</span> <small><i class="fa fa-edit"></i></small></h4>
					<input id="cid-{category.cid}-description" data-name="description" placeholder="Category Description" value="{category.description}" class="form-control category_description input-sm description hide"></input>

					<fieldset>
						<div class="col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-parentCid">Parent Category</label>
								<!-- IF categories.parent.name -->
								<div class="btn-group">
									<button type="button" class="btn btn-default" data-action="setParent" data-parentCid="{category.parent.cid}"><i class="fa {category.parent.icon}"></i> {category.parent.name}</button>
									<button type="button" class="btn btn-warning" data-action="removeParent" data-parentCid="{category.parent.cid}"><i class="fa fa-times"></i></button>
								</div>
								<!-- ELSE -->
								<button type="button" class="btn btn-default form-control" data-action="setParent"><i class="fa fa-sitemap"></i> (None)</button>
								<!-- ENDIF categories.parent.name -->
							</div>
						</div>
					</fieldset>
					<fieldset>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-bgColor">Background Colour</label>
								<input id="cid-{category.cid}-bgColor" placeholder="#0059b2" data-name="bgColor" value="{category.bgColor}" class="form-control category_bgColor" />
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-color">Text Colour</label>
								<input id="cid-{category.cid}-color" placeholder="#fff" data-name="color" value="{category.color}" class="form-control category_color" />
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-imageClass">Image Class</label>
									<select id="cid-{category.cid}-imageClass" class="form-control" data-name="imageClass" data-value="{category.imageClass}">
									<option value="auto">auto</option>
									<option value="cover">cover</option>
									<option value="contain">contain</option>
								</select>
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-class">Custom Class</label>
								<input id="cid-{category.cid}-class" type="text" class="form-control" placeholder="col-md-6 col-xs-6" data-name="class" value="{category.class}" />
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-numRecentReplies"># of Recent Replies Displayed</label>
								<input id="cid-{category.cid}-numRecentReplies" type="text" class="form-control" placeholder="2" data-name="numRecentReplies" value="{category.numRecentReplies}" />
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-link">External Link</label>
								<input id="cid-{category.cid}-link" type="text" class="form-control" placeholder="http://domain.com" data-name="link" value="{category.link}" />
							</div>
						</div>
					</fieldset>
				</div>
			</div>
		</div>

		<div class="col-md-3 options">
			<div class="panel panel-default hidden-sm">
				<div class="panel-heading">Preview</div>
				<div class="panel-body">
					<div class="category-preview" style="
						<!-- IF category.backgroundImage -->background-image: url({category.backgroundImage});<!-- ENDIF category.backgroundImage -->
						<!-- IF category.bgColor -->background-color: {category.bgColor};<!-- ENDIF category.bgColor -->
						color: {category.color};
						background-size:cover;
					">
						<div class="icon">
							<i data-name="icon" value="{category.icon}" class="fa {category.icon} fa-2x"></i>
						</div>
					</div>
					<div class="btn-group-vertical">
						<button type="button" data-cid="{category.cid}" data-name="image" data-value="{category.image}" class="btn btn-default upload-button"><i class="fa fa-upload"></i> Upload Image</button>
						<!-- IF category.image -->
						<button class="btn btn-warning delete-image"><i data-name="icon" value="fa-times" class="fa fa-times"></i> Remove Image</button>
						<!-- ENDIF category.image -->
					</div>
				</div>
			</div>

			<div class="panel panel-default">
				<div class="panel-heading">Categories Control Panel</div>
				<div class="panel-body">
					<div class="btn-group">
						<button class="btn btn-primary save">Save Changes</button>
						<button class="btn btn-default revert">Revert</button>
					</div>
					<hr />
					<button class="btn btn-danger purge"><i class="fa fa-eraser"></i> Purge Category</button>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/categories/setParent.tpl -->
		<div id="icons" style="display:none;">
			<div class="icon-container">
				<div class="row fa-icons">
					<i class="fa fa-doesnt-exist"></i>
					<!-- IMPORT admin/partials/fontawesome.tpl -->
				</div>
			</div>
		</div>
	</form>
</div>