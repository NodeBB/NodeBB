const { test, expect } = require('@playwright/test');

test.describe('Threading Migration and Edge Cases', () => {
  let topicUrl;
  let mainPostPid;

  test.beforeAll(async ({ browser }) => {
    // Create a test user and topic for all tests
    const context = await browser.newContext();
    const page = await context.newPage();

    // Register test user
    await page.goto('/register');
    await page.fill('input[name="username"]', 'migrationtest');
    await page.fill('input[name="email"]', 'migrationtest@example.com');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.fill('input[name="password-confirm"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/^((?!register).)*$/);

    // Create a test topic
    await page.goto('/category/1');
    await page.click('button[data-action="create"]');
    await page.fill('input[name="title"]', 'Migration Test Topic');
    await page.fill('textarea[name="content"]', 'Testing migration and edge cases');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/topic\/\d+/);
    topicUrl = page.url();
    
    const mainPost = await page.locator('[component="post"]').first();
    mainPostPid = await mainPost.getAttribute('data-pid');

    await context.close();
  });

  test.describe('Database Migration Scenarios', () => {
    test('should handle posts migrated from toPid to parentPid', async ({ page }) => {
      await page.goto(topicUrl);

      // Check that API returns parentPid instead of toPid
      const response = await page.request.get(`/api/v3/topics/${topicUrl.split('/').pop()}/posts`);
      const data = await response.json();

      data.posts.forEach(post => {
        if (post.toPid) {
          // If toPid exists, parentPid should match it
          expect(post.parentPid).toBe(post.toPid);
        }
      });
    });

    test('should handle orphaned replies gracefully', async ({ page }) => {
      await page.goto(topicUrl);

      // Simulate an orphaned reply (parentPid points to non-existent post)
      await page.evaluate(async () => {
        await fetch('/api/v3/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Orphaned reply',
            tid: window.ajaxify.data.tid,
            parentPid: 999999 // Non-existent post
          })
        });
      });

      await page.reload();

      // The orphaned post should appear as a top-level post
      const orphanedPost = page.locator('[component="post"]:has-text("Orphaned reply")');
      await expect(orphanedPost).toBeVisible();
      
      // Should not have parent indicator
      const parentIndicator = orphanedPost.locator('[component="post/parent-indicator"]');
      await expect(parentIndicator).not.toBeVisible();
    });
  });

  test.describe('Threading Toggle Edge Cases', () => {
    test('should handle rapid toggle switches', async ({ page }) => {
      await page.goto(topicUrl);

      const toggle = page.locator('[component="topic/threading/toggle"]');
      
      // Rapidly toggle 10 times
      for (let i = 0; i < 10; i++) {
        await toggle.click();
        // Don't wait for animation, click immediately
      }

      // Should end up in the correct state
      const finalState = await toggle.textContent();
      expect(['Flat', 'Threaded']).toContain(finalState.trim());

      // Page should still be functional
      await page.click('[component="topic/reply"]');
      await expect(page.locator('[component="composer"]')).toBeVisible();
    });

    test('should preserve scroll position when toggling views', async ({ page }) => {
      await page.goto(topicUrl);

      // Create several posts to enable scrolling
      for (let i = 0; i < 5; i++) {
        await page.click('[component="topic/reply"]');
        await page.fill('[component="composer"] textarea', `Post ${i} for scroll test`);
        await page.click('[component="composer/submit"]');
        await page.waitForSelector(`[component="post"]:has-text("Post ${i} for scroll test")`);
      }

      // Scroll to middle post
      const middlePost = page.locator('[component="post"]').nth(3);
      await middlePost.scrollIntoViewIfNeeded();
      
      const scrollBefore = await page.evaluate(() => window.scrollY);

      // Toggle view
      await page.click('[component="topic/threading/toggle"]');

      // Check scroll position is maintained (within reasonable range)
      const scrollAfter = await page.evaluate(() => window.scrollY);
      expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(200);
    });
  });

  test.describe('Special Characters and Content', () => {
    test('should handle posts with special characters in threaded view', async ({ page }) => {
      await page.goto(topicUrl);

      const specialContents = [
        'Post with emojis 😀 🎉 🚀',
        'Post with <script>alert("XSS")</script> HTML',
        'Post with `code blocks` and **markdown**',
        'Post with Unicode: 你好世界 مرحبا بالعالم',
        'Post with long URL: https://example.com/very/long/path/that/might/break/layout'
      ];

      // Create posts with special content
      for (const content of specialContents) {
        await page.click('[component="topic/reply"]');
        await page.fill('[component="composer"] textarea', content);
        await page.click('[component="composer/submit"]');
        await page.waitForTimeout(500); // Brief delay between posts
      }

      // Switch to threaded view
      await page.click('[component="topic/threading/toggle"]');

      // Verify all posts are visible and properly rendered
      for (const content of specialContents) {
        const post = page.locator('[component="post"]').filter({ hasText: content.substring(0, 20) });
        await expect(post).toBeVisible();
      }

      // Check that HTML is escaped
      const htmlPost = page.locator('[component="post"]').filter({ hasText: 'script' });
      const htmlContent = await htmlPost.locator('[component="post/content"]').innerHTML();
      expect(htmlContent).not.toContain('<script>');
      expect(htmlContent).toContain('&lt;script&gt;');
    });
  });

  test.describe('Deleted Posts Handling', () => {
    test('should handle deleted parent posts', async ({ page }) => {
      await page.goto(topicUrl);

      // Create parent and child posts
      await page.click('[component="topic/reply"]');
      await page.fill('[component="composer"] textarea', 'Parent post to delete');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Parent post to delete")');

      const parentPost = page.locator('[component="post"]:has-text("Parent post to delete")');
      const parentPid = await parentPost.getAttribute('data-pid');

      // Reply to parent
      await parentPost.locator('[component="post/reply"]').click();
      await page.fill('[component="composer"] textarea', 'Child of deleted parent');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Child of deleted parent")');

      // Delete parent post
      await parentPost.locator('[component="post/delete"]').click();
      await page.click('button:has-text("Delete")'); // Confirm deletion

      // Switch to threaded view
      await page.click('[component="topic/threading/toggle"]');

      // Child post should still be visible but as top-level
      const childPost = page.locator('[component="post"]:has-text("Child of deleted parent")');
      await expect(childPost).toBeVisible();
      
      // Should show deleted parent indicator or be at depth 0
      const depth = await childPost.getAttribute('data-depth');
      expect(parseInt(depth)).toBe(0);
    });

    test('should handle purged parent posts', async ({ page }) => {
      await page.goto(topicUrl);

      // Similar to deleted but for purged (completely removed) posts
      // This tests the orphan handling when parent is completely gone
      
      // Create a post that will reference a non-existent parent
      await page.evaluate(async (pid) => {
        await fetch('/api/v3/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Reply to purged post',
            tid: window.ajaxify.data.tid,
            parentPid: parseInt(pid) + 1000 // Likely non-existent
          })
        });
      }, mainPostPid);

      await page.reload();

      const orphanPost = page.locator('[component="post"]:has-text("Reply to purged post")');
      await expect(orphanPost).toBeVisible();
      
      // Should appear as top-level post
      const depth = await orphanPost.getAttribute('data-depth');
      expect(parseInt(depth) || 0).toBe(0);
    });
  });

  test.describe('Cross-topic Reply Prevention', () => {
    test('should prevent replies to posts from different topics', async ({ page }) => {
      // Create another topic
      await page.goto('/category/1');
      await page.click('button[data-action="create"]');
      await page.fill('input[name="title"]', 'Another Topic');
      await page.fill('textarea[name="content"]', 'Different topic content');
      await page.click('[component="composer/submit"]');
      await page.waitForURL(/\/topic\/\d+/);

      const anotherTopicPost = await page.locator('[component="post"]').first();
      const anotherPid = await anotherTopicPost.getAttribute('data-pid');

      // Go back to original topic
      await page.goto(topicUrl);

      // Try to create a post with parentPid from another topic
      const response = await page.request.post('/api/v3/posts', {
        data: {
          content: 'Invalid cross-topic reply',
          tid: topicUrl.split('/').pop(),
          parentPid: anotherPid
        }
      });

      // Should be rejected
      expect(response.status()).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('cross-topic');
    });
  });

  test.describe('Pagination with Threading', () => {
    test('should handle threaded posts across pages', async ({ page }) => {
      await page.goto(topicUrl);

      // Create many posts to trigger pagination
      const postCount = 25; // Assuming 20 posts per page
      for (let i = 0; i < postCount; i++) {
        await page.evaluate(async (index) => {
          await fetch('/api/v3/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `Pagination test post ${index}`,
              tid: window.ajaxify.data.tid
            })
          });
        }, i);
      }

      await page.reload();

      // Create a threaded reply to a post on page 1
      const firstPagePost = page.locator('[component="post"]').nth(5);
      await firstPagePost.locator('[component="post/reply"]').click();
      await page.fill('[component="composer"] textarea', 'Reply spanning pages');
      await page.click('[component="composer/submit"]');

      // Navigate to page 2
      await page.click('[component="pagination"] a:has-text("2")');

      // Switch to threaded view
      await page.click('[component="topic/threading/toggle"]');

      // The reply should either:
      // 1. Appear on the same page as its parent, or
      // 2. Show an indicator that it has a parent on another page
      const reply = page.locator('[component="post"]:has-text("Reply spanning pages")');
      if (await reply.isVisible()) {
        const parentIndicator = reply.locator('[component="post/parent-indicator"]');
        await expect(parentIndicator).toBeVisible();
      }
    });
  });

  test.describe('Performance Edge Cases', () => {
    test('should handle deeply nested threads efficiently', async ({ page }) => {
      await page.goto(topicUrl);

      let currentPid = mainPostPid;
      
      // Create a deep thread (up to max depth)
      for (let i = 0; i < 5; i++) {
        const currentPost = page.locator(`[component="post"][data-pid="${currentPid}"]`);
        await currentPost.locator('[component="post/reply"]').click();
        await page.fill('[component="composer"] textarea', `Nested level ${i + 1}`);
        await page.click('[component="composer/submit"]');
        await page.waitForSelector(`[component="post"]:has-text("Nested level ${i + 1}")`);
        
        // Get the new post's PID for next iteration
        const newPost = page.locator(`[component="post"]:has-text("Nested level ${i + 1}")`);
        currentPid = await newPost.getAttribute('data-pid');
      }

      // Switch to threaded view
      const startTime = Date.now();
      await page.click('[component="topic/threading/toggle"]');
      
      // Should render within reasonable time
      await expect(page.locator('[data-depth="4"]')).toBeVisible({ timeout: 3000 });
      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(3000);

      // Verify depth rendering
      for (let i = 0; i < 5; i++) {
        const post = page.locator(`[component="post"]:has-text("Nested level ${i + 1}")`);
        const depth = await post.getAttribute('data-depth');
        expect(parseInt(depth)).toBe(i + 1);
      }
    });

    test('should handle topics with mixed threading patterns', async ({ page }) => {
      await page.goto(topicUrl);

      // Create a complex threading pattern
      // Main post
      //   ├── Reply 1
      //   │   ├── Reply 1.1
      //   │   └── Reply 1.2
      //   │       └── Reply 1.2.1
      //   └── Reply 2
      //       └── Reply 2.1

      const posts = [];
      
      // Create Reply 1
      await page.click('[component="topic/reply"]');
      await page.fill('[component="composer"] textarea', 'Reply 1');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Reply 1")');
      posts.push(await page.locator('[component="post"]:has-text("Reply 1")').getAttribute('data-pid'));

      // Create Reply 2
      await page.click('[component="topic/reply"]');
      await page.fill('[component="composer"] textarea', 'Reply 2');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Reply 2")');
      posts.push(await page.locator('[component="post"]:has-text("Reply 2")').getAttribute('data-pid'));

      // Create nested replies
      const reply1 = page.locator('[component="post"]:has-text("Reply 1")');
      await reply1.locator('[component="post/reply"]').click();
      await page.fill('[component="composer"] textarea', 'Reply 1.1');
      await page.click('[component="composer/submit"]');

      await reply1.locator('[component="post/reply"]').click();
      await page.fill('[component="composer"] textarea', 'Reply 1.2');
      await page.click('[component="composer/submit"]');

      // More nesting
      const reply12 = page.locator('[component="post"]:has-text("Reply 1.2")');
      await reply12.locator('[component="post/reply"]').click();
      await page.fill('[component="composer"] textarea', 'Reply 1.2.1');
      await page.click('[component="composer/submit"]');

      const reply2 = page.locator('[component="post"]:has-text("Reply 2")');
      await reply2.locator('[component="post/reply"]').click();
      await page.fill('[component="composer"] textarea', 'Reply 2.1');
      await page.click('[component="composer/submit"]');

      // Switch to threaded view
      await page.click('[component="topic/threading/toggle"]');

      // Verify the structure is correctly rendered
      await expect(page.locator('[component="post"]:has-text("Reply 1.1")[data-depth="1"]')).toBeVisible();
      await expect(page.locator('[component="post"]:has-text("Reply 1.2")[data-depth="1"]')).toBeVisible();
      await expect(page.locator('[component="post"]:has-text("Reply 1.2.1")[data-depth="2"]')).toBeVisible();
      await expect(page.locator('[component="post"]:has-text("Reply 2.1")[data-depth="1"]')).toBeVisible();
    });
  });
});