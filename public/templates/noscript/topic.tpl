		<ul class="posts">
			<!-- BEGIN main_posts -->
			<li>
				<div class="row-fluid">
					<div class="span2">
						<img src="{main_posts.picture}" /><br />
						{main_posts.username}
					</div>
					<div class="span10">
						{main_posts.content}
					</div>
				</div>
			</li>
			<!-- END main_posts -->
			<!-- BEGIN posts -->
			<li>
				<div class="row-fluid">
					<div class="span2">
						<img src="{posts.picture}" /><br />
						{posts.username}
					</div>
					<div class="span10">
						{posts.content}
					</div>
					<div class="clear"></div>
				</div>
			</li>
			<!-- END posts -->
		</ul>