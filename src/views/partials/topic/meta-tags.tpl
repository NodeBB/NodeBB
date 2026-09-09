<meta itemprop="headline" content="{title}">
<meta itemprop="text" content="{title}">
<meta itemprop="url" content="{url}">
<meta itemprop="datePublished" content="{timestampISO}">
<meta itemprop="dateModified" content="{lastposttimeISO}">
<div itemprop="author" itemscope itemtype="https://schema.org/Person">
	<meta itemprop="name" content="{author.username}">
	{{{ if author.userslug }}}<meta itemprop="url" content="{config.relative_path}/user/{author.userslug}">{{{ end }}}
</div>
<div itemprop="interactionStatistic" itemscope itemtype="https://schema.org/InteractionCounter">
	<meta itemprop="interactionType" content="https://schema.org/CommentAction">
	<meta itemprop="userInteractionCount" content="{increment(postcount, "-1")}">
</div>
<div itemprop="interactionStatistic" itemscope itemtype="https://schema.org/InteractionCounter">
	<meta itemprop="interactionType" content="https://schema.org/LikeAction">
	<meta itemprop="userInteractionCount" content="{upvotes}">
</div>