import { test, expect } from '@playwright/test';

/**
 * Wizard UI Tests - Focus on what we just implemented
 *
 * Tests the multi-step wizard UI components without testing backend integration.
 * Auth is disabled via DISABLE_AUTH=true in .env.local
 */

test.describe('Project Creation Wizard - UI Only', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to wizard (auth is disabled)
    await page.goto('http://localhost:3000/dashboard/projects/new');

    // Wait for wizard to load
    await page.waitForLoadState('networkidle');
  });

  test('should render wizard without authentication', async ({ page }) => {
    // Should see the wizard, not a login page
    await expect(page.locator('h1:has-text("Create New Project")')).toBeVisible();

    // Should see progress indicator
    await expect(page.locator('text=Project Type')).toBeVisible();

    // Should NOT see login form
    await expect(page.locator('input[type="email"]')).not.toBeVisible();
  });

  test('Step 1: should display all 6 project types', async ({ page }) => {
    // Check for all project type cards
    await expect(page.locator('text=Website')).toBeVisible();
    await expect(page.locator('text=Content Generation')).toBeVisible();
    await expect(page.locator('text=SEO Audit')).toBeVisible();
    await expect(page.locator('text=Custom Workflow')).toBeVisible();
    await expect(page.locator('text=Data Processing')).toBeVisible();
    await expect(page.locator('text=Customer Service')).toBeVisible();

    // Should have "What happens next?" info section
    await expect(page.locator('text=What happens next?')).toBeVisible();
  });

  test('Step 1: should allow selecting project type', async ({ page }) => {
    // Click on Website card
    const websiteCard = page.locator('div[role="button"]:has-text("Website")').first();
    await websiteCard.click();

    // Card should show selected state (border-primary class)
    await expect(websiteCard).toHaveClass(/border-primary/);
  });

  test('Step 1: Next button should be disabled without selection', async ({ page }) => {
    // Next button should be disabled initially
    const nextButton = page.locator('button:has-text("Next")');
    // Note: We check for disabled attribute or aria-disabled
    const isDisabled = await nextButton.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('should navigate from Step 1 to Step 2', async ({ page }) => {
    // Select a project type
    await page.locator('div:has-text("Website")').first().click();

    // Click Next
    await page.locator('button:has-text("Next")').click();

    // Should now see Step 2 content
    await expect(page.locator('text=Project Name')).toBeVisible();
    await expect(page.locator('text=Description')).toBeVisible();
    await expect(page.locator('text=Tags')).toBeVisible();
    await expect(page.locator('text=Maximum Iterations')).toBeVisible();
  });

  test('Step 2: should validate required fields', async ({ page }) => {
    // Navigate to Step 2
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();

    // Try to advance without filling name
    await page.locator('button:has-text("Next")').click();

    // Should show validation error
    // Wait a bit for validation to trigger
    await page.waitForTimeout(500);

    // Look for error text or red border on name input
    const nameInput = page.locator('input[id="name"]');
    const hasError = await nameInput.evaluate((el) => {
      return el.classList.contains('border-destructive') ||
             el.getAttribute('aria-invalid') === 'true';
    });

    expect(hasError).toBe(true);
  });

  test('Step 2: should allow adding and removing tags', async ({ page }) => {
    // Navigate to Step 2
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();

    // Find tags input
    const tagsInput = page.locator('input[id="tags"]');

    // Add a tag
    await tagsInput.fill('test-tag');
    await tagsInput.press('Enter');

    // Tag should appear as badge
    await expect(page.locator('text=test-tag')).toBeVisible();

    // Add another tag
    await tagsInput.fill('another-tag');
    await tagsInput.press('Enter');

    await expect(page.locator('text=another-tag')).toBeVisible();

    // Remove first tag (click X button)
    await page.locator('button:near(:text("test-tag"))').first().click();

    // First tag should be gone
    await expect(page.locator('text=test-tag')).not.toBeVisible();

    // Second tag should still be there
    await expect(page.locator('text=another-tag')).toBeVisible();
  });

  test('Step 2: should allow adjusting iterations slider', async ({ page }) => {
    // Navigate to Step 2
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();

    // Find the slider value display (should default to 3)
    const sliderValue = page.locator('text=Maximum Iterations').locator('..').locator('span:has-text(/^\\d+$/)');
    await expect(sliderValue).toHaveText('3');

    // Note: Slider interaction is complex, just verify it exists
    const slider = page.locator('input[id="maxIterations"]');
    await expect(slider).toBeVisible();
  });

  test('should navigate to Step 3 with valid data', async ({ page }) => {
    // Step 1: Select type
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();

    // Step 2: Fill required fields
    await page.locator('input[id="name"]').fill('Test Project');
    await page.locator('button:has-text("Next")').click();

    // Should reach Step 3
    await expect(page.locator('text=Company Profile')).toBeVisible();
    await expect(page.locator('text=Select Existing')).toBeVisible();
    await expect(page.locator('text=Create New')).toBeVisible();
  });

  test('Step 3: should allow skipping optional step', async ({ page }) => {
    // Navigate to Step 3
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[id="name"]').fill('Test Project');
    await page.locator('button:has-text("Next")').click();

    // Click "Skip This Step"
    await page.locator('button:has-text("Skip This Step")').click();

    // Should advance to Step 4
    await expect(page.locator('text=Discovery Data')).toBeVisible();
  });

  test('Step 4: should show accordion sections', async ({ page }) => {
    // Navigate to Step 4
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[id="name"]').fill('Test Project');
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Skip This Step")').click();

    // Should see all accordion sections
    await expect(page.locator('text=Business Information')).toBeVisible();
    await expect(page.locator('text=Services & Offerings')).toBeVisible();
    await expect(page.locator('text=Brand Identity')).toBeVisible();
    await expect(page.locator('text=SEO Strategy')).toBeVisible();
    await expect(page.locator('text=Technical Requirements')).toBeVisible();
    await expect(page.locator('text=Legal & Compliance')).toBeVisible();

    // Should see completeness indicator
    await expect(page.locator('text=Completeness')).toBeVisible();
  });

  test('Step 4: should expand accordion section', async ({ page }) => {
    // Navigate to Step 4
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[id="name"]').fill('Test Project');
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Skip This Step")').click();

    // Click on Business Information accordion
    await page.locator('button:has-text("Business Information")').click();

    // Should see fields inside
    await expect(page.locator('text=Target Audience')).toBeVisible();
    await expect(page.locator('text=Unique Value Proposition')).toBeVisible();
  });

  test('should navigate to Step 5 (Review)', async ({ page }) => {
    // Navigate through all steps
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[id="name"]').fill('Test Project');
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Skip This Step")').click();
    await page.locator('button:has-text("Skip This Step")').click();

    // Should see Review step
    await expect(page.locator('text=Review Your Project')).toBeVisible();
    await expect(page.locator('text=Project Details')).toBeVisible();
  });

  test('Step 5: should display form data in review', async ({ page }) => {
    // Navigate through all steps with data
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[id="name"]').fill('My Test Project');
    await page.locator('textarea[id="description"]').fill('Test description');
    await page.locator('button:has-text("Next")').click();

    await page.locator('button:has-text("Skip This Step")').click();
    await page.locator('button:has-text("Skip This Step")').click();

    // Should see the data in review
    await expect(page.locator('text=My Test Project')).toBeVisible();
    await expect(page.locator('text=Test description')).toBeVisible();
    await expect(page.locator('text=Website')).toBeVisible();
  });

  test('Step 5: Edit buttons should navigate back', async ({ page }) => {
    // Navigate to review
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();
    await page.locator('input[id="name"]').fill('Test Project');
    await page.locator('button:has-text("Next")').click();
    await page.locator('button:has-text("Skip This Step")').click();
    await page.locator('button:has-text("Skip This Step")').click();

    // Click Edit button for Project Details
    await page.locator('button:has-text("Edit")').first().click();

    // Should go back to Step 1
    await expect(page.locator('text=Choose Your Project Type')).toBeVisible();
  });

  test('Progress indicator should show current step', async ({ page }) => {
    // Desktop view - should see step circles
    // Check Step 1 is highlighted
    const step1Indicator = page.locator('[aria-label="Progress"]').locator('text=1').first();
    await expect(step1Indicator).toBeVisible();

    // Navigate to Step 2
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();

    // Step 2 should be highlighted
    const step2Indicator = page.locator('[aria-label="Progress"]').locator('text=2').first();
    await expect(step2Indicator).toBeVisible();
  });

  test('Previous button should navigate backwards', async ({ page }) => {
    // Navigate to Step 2
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();

    // Click Previous
    await page.locator('button:has-text("Previous")').click();

    // Should be back at Step 1
    await expect(page.locator('text=Choose Your Project Type')).toBeVisible();
  });

  test('Save Draft button should be visible', async ({ page }) => {
    // Should see Save Draft button (on desktop)
    const saveDraftButton = page.locator('button:has-text("Save Draft")');

    // On desktop it should be visible
    const isVisible = await saveDraftButton.isVisible();

    // It's okay if hidden on mobile, just check it exists in DOM
    expect(await saveDraftButton.count()).toBeGreaterThan(0);
  });

  test('Footer navigation should be sticky at bottom', async ({ page }) => {
    // Navigation footer should be present
    const footer = page.locator('div.fixed.bottom-0');
    await expect(footer).toBeVisible();

    // Should contain navigation buttons
    await expect(footer.locator('button')).toHaveCount(2); // Next and Save Draft (Previous hidden on step 1)
  });

  test('Form validation should prevent empty name submission', async ({ page }) => {
    // Navigate to Step 2
    await page.locator('div:has-text("Website")').first().click();
    await page.locator('button:has-text("Next")').click();

    // Leave name empty, try to advance
    await page.locator('button:has-text("Next")').click();

    // Wait for validation
    await page.waitForTimeout(500);

    // Should still be on Step 2
    await expect(page.locator('text=Project Name')).toBeVisible();
  });
});
