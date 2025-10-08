const { test, expect } = require('@playwright/test');
const { 
  loginAsUser, 
  createTopic, 
  createReply, 
  toggleThreadView,
  expandThread,
  collapseThread,
  getPostDepth,
  getThreadedPosts,
  waitForSocketEvent
} = require('./helpers');

test.describe('Threaded Replies Feature', () => {
  let topicId;
  let mainPostPid;

  test.beforeAll(async ({ browser }) => {
    // Create a test user and topic for all tests
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Register test user (assuming registration is available)
    await page.goto('/register');
    await page.fill('input[name="username"]', 'threadtest');
    await page.fill('input[name="email"]', 'threadtest@example.com');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.fill('input[name="password-confirm"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    // Wait for registration to complete
    await page.waitForURL(/^((?!register).)*$/);
    
    // Create a test topic
    topicId = await createTopic(page, 1, 'Threading Test Topic', 'This is the main post for testing threading');
    
    // Get main post PID
    mainPostPid = await page.locator('[component="post"]:first-child').getAttribute('data-pid');
    
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsUser(page, 'threadtest', 'TestPass123!');
  });

  test.describe('Thread View Toggle', () => {
    test('should display toggle button in topic toolbar', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      const toggleButton = page.locator('[data-action="toggle-threading"]');
      await expect(toggleButton).toBeVisible();
      await expect(toggleButton).toContainText('Threaded');
    });

    test('should switch between flat and threaded views', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      
      // Initially in flat view
      const toggleButton = page.locator('[data-action="toggle-threading"]');
      await expect(toggleButton).not.toHaveClass(/active/);
      
      // Switch to threaded view
      await toggleThreadView(page);
      await expect(toggleButton).toHaveClass(/active/);
      await expect(toggleButton).toContainText('Flat');
      
      // Switch back to flat view
      await toggleThreadView(page);
      await expect(toggleButton).not.toHaveClass(/active/);
      await expect(toggleButton).toContainText('Threaded');
    });

    test('should persist view preference in session', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      
      // Switch to threaded view
      await toggleThreadView(page);
      
      // Navigate away and back
      await page.goto('/');
      await page.goto(`/topic/${topicId}`);
      
      // Should still be in threaded view
      const toggleButton = page.locator('[data-action="toggle-threading"]');
      await expect(toggleButton).toHaveClass(/active/);
    });
  });

  test.describe('Creating Threaded Replies', () => {
    test('should create a reply to the main post', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      
      // Create a reply to main post
      await createReply(page, 'This is a threaded reply to the main post', mainPostPid);
      
      // Verify reply appears
      const replies = await page.locator('[component="post"]').count();
      expect(replies).toBeGreaterThan(1);
    });

    test('should create nested replies (grandchild)', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      
      // Find first reply
      const firstReply = await page.locator('[component="post"]:nth-child(2)').getAttribute('data-pid');
      
      // Create reply to the reply
      await createReply(page, 'This is a reply to the reply', firstReply);
      
      // Switch to threaded view to see nesting
      await toggleThreadView(page);
      
      // Check depth of grandchild post
      const posts = await getThreadedPosts(page);
      const grandchild = posts.find(p => p.content.includes('reply to the reply'));
      expect(grandchild).toBeTruthy();
      expect(grandchild.depth).toBe(2);
    });

    test('should show parent post indicator', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      
      // Create a reply with parent
      await createReply(page, 'Reply with parent indicator', mainPostPid);
      
      // Check for parent indicator
      const lastPost = page.locator('[component="post"]:last-child');
      const parentIndicator = lastPost.locator('.parent-post-indicator');
      await expect(parentIndicator).toBeVisible();
    });
  });

  test.describe('Thread Collapse/Expand', () => {
    test('should show collapse button for posts with children', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      await toggleThreadView(page);
      
      // Main post should have collapse button
      const collapseBtn = page.locator(`[component="post"][data-pid="${mainPostPid}"] .thread-toggle`);
      await expect(collapseBtn).toBeVisible();
      await expect(collapseBtn).toContainText('');
      expect(await collapseBtn.locator('i').getAttribute('class')).toContain('fa-minus');
    });

    test('should collapse and expand thread branches', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      await toggleThreadView(page);
      
      const posts = await getThreadedPosts(page);
      const postsWithChildren = posts.filter(p => p.hasChildren);
      
      if (postsWithChildren.length > 0) {
        const parentPid = postsWithChildren[0].pid;
        
        // Collapse thread
        await collapseThread(page, parentPid);
        
        // Check children are hidden
        const childrenContainer = page.locator(`[component="post"][data-pid="${parentPid}"] .threaded-children`);
        await expect(childrenContainer).toBeHidden();
        
        // Expand thread
        await expandThread(page, parentPid);
        
        // Check children are visible
        await expect(childrenContainer).toBeVisible();
      }
    });
  });

  test.describe('Depth Limitations', () => {
    test('should enforce maximum thread depth', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      
      // Create a deep thread (assuming max depth is 5)
      let currentPid = mainPostPid;
      
      for (let i = 1; i <= 5; i++) {
        await createReply(page, `Depth level ${i}`, currentPid);
        await page.waitForTimeout(1000);
        
        // Get the newly created post
        const newPost = await page.locator('[component="post"]:last-child');
        currentPid = await newPost.getAttribute('data-pid');
      }
      
      // Try to create one more level (should fail or be placed at max depth)
      await createReply(page, 'This should be at max depth', currentPid);
      
      // Switch to threaded view
      await toggleThreadView(page);
      
      // Check that last post is at max depth (5)
      const lastPost = await page.locator('[component="post"]:last-child');
      const depth = await lastPost.getAttribute('data-depth');
      expect(parseInt(depth)).toBeLessThanOrEqual(5);
    });

    test('should show depth limit warning', async ({ page }) => {
      // This test assumes the UI shows a warning when max depth is reached
      await page.goto(`/topic/${topicId}`);
      
      // Navigate to a post at max depth
      const deepPost = await page.locator('[component="post"][data-depth="5"]').first();
      
      if (await deepPost.count() > 0) {
        // Click reply on max depth post
        await deepPost.locator('[component="post/reply"]').click();
        
        // Check for warning message
        const warning = page.locator('.composer .alert-warning');
        await expect(warning).toContainText(/depth|limit/i);
      }
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update threaded view in real-time', async ({ page, browser }) => {
      // Open two browser contexts
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await loginAsUser(page2, 'threadtest', 'TestPass123!');
      
      // Both view the same topic in threaded mode
      await page.goto(`/topic/${topicId}`);
      await toggleThreadView(page);
      
      await page2.goto(`/topic/${topicId}`);
      await toggleThreadView(page2);
      
      // User 2 creates a reply
      const postCount = await page.locator('[component="post"]').count();
      await createReply(page2, 'Real-time threaded reply', mainPostPid);
      
      // User 1 should see the new post
      await page.waitForSelector(`[component="post"]:nth-child(${postCount + 1})`);
      const newPostCount = await page.locator('[component="post"]').count();
      expect(newPostCount).toBe(postCount + 1);
      
      // Verify it's properly nested
      const posts = await getThreadedPosts(page);
      const rtPost = posts.find(p => p.content.includes('Real-time threaded reply'));
      expect(rtPost).toBeTruthy();
      expect(rtPost.depth).toBe(1);
      
      await context2.close();
    });
  });

  test.describe('Mobile Responsive', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should show threading with reduced indentation on mobile', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      await toggleThreadView(page);
      
      // Check that threaded posts are visible but with less indentation
      const threadedPost = await page.locator('.threaded-post.depth-1').first();
      const computedStyle = await threadedPost.evaluate(el => 
        window.getComputedStyle(el).marginLeft
      );
      
      // Mobile should have less indentation (15px vs 30px on desktop)
      expect(parseInt(computedStyle)).toBeLessThanOrEqual(15);
    });

    test('should hide deep nesting on mobile', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      await toggleThreadView(page);
      
      // Posts at depth 4 and 5 should have the same indentation
      const depth4 = await page.locator('[component="post"][data-depth="4"]').first();
      const depth5 = await page.locator('[component="post"][data-depth="5"]').first();
      
      if (await depth4.count() > 0 && await depth5.count() > 0) {
        const margin4 = await depth4.evaluate(el => 
          window.getComputedStyle(el).marginLeft
        );
        const margin5 = await depth5.evaluate(el => 
          window.getComputedStyle(el).marginLeft
        );
        
        // Both should have the same margin on mobile
        expect(margin4).toBe(margin5);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      await toggleThreadView(page);
      
      // Thread toggle button
      const toggleBtn = page.locator('[data-action="toggle-threading"]');
      await expect(toggleBtn).toHaveAttribute('title', 'Toggle threaded view');
      
      // Collapse buttons
      const collapseBtn = page.locator('.thread-toggle').first();
      await expect(collapseBtn).toHaveAttribute('aria-label', /collapse|expand/i);
      
      // Thread depth for screen readers
      const threadedPost = page.locator('.threaded-post').first();
      await expect(threadedPost).toHaveAttribute('aria-level', /.+/);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto(`/topic/${topicId}`);
      await toggleThreadView(page);
      
      // Tab to thread toggle
      await page.keyboard.press('Tab');
      const toggleBtn = page.locator('[data-action="toggle-threading"]');
      await expect(toggleBtn).toBeFocused();
      
      // Activate with Enter
      await page.keyboard.press('Enter');
      await expect(toggleBtn).not.toHaveClass(/active/);
      
      // Tab to collapse button
      const collapseBtn = page.locator('.thread-toggle').first();
      await collapseBtn.focus();
      await page.keyboard.press('Enter');
      
      // Verify collapse worked
      const children = collapseBtn.locator('~ .threaded-children');
      await expect(children).toBeHidden();
    });
  });
});