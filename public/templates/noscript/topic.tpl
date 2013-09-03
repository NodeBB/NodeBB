		<ul class="posts">
			<!-- BEGIN main_posts -->
			<li>
				<a name="{main_posts.pid}"></a>
				<div class="row">
					<div class="col-lg-2 profile">
						<img class="img-thumbnail" src="{main_posts.picture}" /><br />
						<span class="username">{main_posts.username}</span>
					</div>
					<div class="col-lg-10">
						{main_posts.content}
					</div>
				</div>
			</li>
			<!-- END main_posts -->
			<!-- BEGIN posts -->
			<li>
				<a name="{posts.pid}"></a>
				<div class="row">
					<div class="col-lg-2 profile">
						<img class="img-thumbnail" src="{posts.picture}" /><br />
						<span class="username">{posts.username}</span>
					</div>
					<div class="col-lg-10">
						{posts.content}
					</div>
					<div class="clear"></div>
				</div>
			</li>
			<!-- END posts -->
		</ul>