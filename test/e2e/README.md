# NodeBB Threading Feature - E2E Tests

This directory contains end-to-end tests for the NodeBB threading feature using Playwright.

## Setup

1. Install Playwright and its dependencies:
```bash
npm install --save-dev @playwright/test
npx playwright install
```

2. Ensure NodeBB is configured and running:
```bash
./nodebb setup  # If not already done
./nodebb dev    # Or use ./nodebb start
```

3. Create test users (if not already created):
   - Admin user: `admin` / `adminpass`
   - Test user: `threadtest` / `TestPass123!`

## Running Tests

### Run all E2E tests:
```bash
npx playwright test
```

### Run only threading tests:
```bash
npx playwright test threading.spec.js
```

### Run admin settings tests:
```bash
npx playwright test threading-admin.spec.js
```

### Run tests in UI mode (interactive):
```bash
npx playwright test --ui
```

### Run tests with specific browser:
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run mobile tests:
```bash
npx playwright test --project="Mobile Chrome"
npx playwright test --project="Mobile Safari"
```

### Generate test report:
```bash
npx playwright show-report
```

## Test Coverage

The E2E tests cover the following scenarios:

### Threading Feature Tests (`threading.spec.js`)
- **Thread View Toggle**
  - Toggle button visibility
  - Switching between flat and threaded views
  - View preference persistence
  
- **Creating Threaded Replies**
  - Reply to main post
  - Create nested replies (grandchild posts)
  - Parent post indicators
  
- **Thread Collapse/Expand**
  - Collapse/expand buttons for posts with children
  - Hide/show thread branches
  
- **Depth Limitations**
  - Maximum thread depth enforcement
  - Depth limit warnings
  
- **Real-time Updates**
  - WebSocket updates in threaded view
  - Multi-user threading scenarios
  
- **Mobile Responsive**
  - Reduced indentation on mobile
  - Deep nesting handling
  
- **Accessibility**
  - ARIA labels
  - Keyboard navigation

### Admin Settings Tests (`threading-admin.spec.js`)
- Settings page display
- Configuration options
- Settings persistence
- Input validation
- Applied settings verification

## Debugging

### Take screenshots on failure:
Tests are configured to automatically take screenshots on failure. Find them in:
```
test-results/[test-name]/test-failed-1.png
```

### Run in headed mode (see browser):
```bash
npx playwright test --headed
```

### Run with debug mode:
```bash
npx playwright test --debug
```

### Slow down execution:
```bash
npx playwright test --slow-mo=1000  # 1 second delay between actions
```

## Visual Mockup

To view the visual mockup of the threading feature:
1. Open `/docs/threading-mockup.html` in a web browser
2. The mockup shows:
   - Flat view (traditional)
   - Threaded view with visual hierarchy
   - Collapsed threads
   - Admin settings panel

## Configuration

Edit `playwright.config.js` to modify:
- Base URL (default: `http://localhost:4567`)
- Test timeout
- Number of workers
- Browser settings
- Screenshot/video recording options

## CI/CD Integration

To run E2E tests in CI:

```yaml
# Example GitHub Actions workflow
- name: Install Playwright
  run: |
    npm ci
    npx playwright install --with-deps
    
- name: Run E2E tests
  run: npx playwright test
  
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests fail with "No NodeBB running"
- Ensure NodeBB is running: `./nodebb dev`
- Check the base URL in `playwright.config.js`

### Login failures
- Verify test user credentials exist
- Check if registration is enabled for new users

### WebSocket errors
- Ensure Socket.io is properly configured
- Check for CORS issues if running on different ports

### Timeout errors
- Increase timeout in `playwright.config.js`
- Add explicit waits for slow operations
- Check if NodeBB is running in development mode

## Contributing

When adding new threading features, please:
1. Add corresponding E2E tests
2. Update this README with new test scenarios
3. Ensure tests pass on all supported browsers
4. Add accessibility tests for new UI elements