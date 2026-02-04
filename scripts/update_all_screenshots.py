#!/usr/bin/env python3
"""
Complete screenshot update for CCB Gateway Web UI
Captures all tabs with latest v0.15 features
"""

from playwright.sync_api import sync_playwright
import time

SCREENSHOTS_DIR = '/Users/leo/.local/share/codex-dual/screenshots'

def capture_all_screenshots():
    with sync_playwright() as p:
        print("🚀 Launching browser...")
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.set_viewport_size({"width": 1400, "height": 900})

        # Navigate to Gateway UI
        print("📱 Opening Gateway UI at http://localhost:8765")
        page.goto('http://localhost:8765')
        page.wait_for_load_state('networkidle')
        time.sleep(2)

        # Screenshot 1: Dashboard (default view)
        print("\n1️⃣  Capturing Dashboard...")
        page.keyboard.press('1')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/dashboard.png')
        print("   ✅ dashboard.png")

        # Screenshot 2: Monitor tab
        print("\n2️⃣  Capturing Monitor...")
        page.keyboard.press('2')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/monitor.png')
        print("   ✅ monitor.png")

        # Screenshot 3: Discussions tab
        print("\n3️⃣  Capturing Discussions...")
        page.keyboard.press('3')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/discussions.png')
        print("   ✅ discussions.png")

        # Screenshot 4: Requests tab
        print("\n4️⃣  Capturing Requests...")
        page.keyboard.press('4')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/requests.png')
        print("   ✅ requests.png")

        # Screenshot 5: Costs tab (NEW in v0.15)
        print("\n5️⃣  Capturing Costs tab...")
        page.keyboard.press('5')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/costs.png')
        print("   ✅ costs.png")

        # Screenshot 6: Test tab
        print("\n6️⃣  Capturing Test...")
        page.keyboard.press('6')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/test.png')
        print("   ✅ test.png")

        # Screenshot 7: Compare tab
        print("\n7️⃣  Capturing Compare...")
        page.keyboard.press('7')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/compare.png')
        print("   ✅ compare.png")

        # Screenshot 8: API Keys tab
        print("\n8️⃣  Capturing API Keys...")
        page.keyboard.press('8')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/api-keys.png')
        print("   ✅ api-keys.png")

        # Screenshot 9: Config tab
        print("\n9️⃣  Capturing Config...")
        page.keyboard.press('9')
        time.sleep(1.5)
        page.screenshot(path=f'{SCREENSHOTS_DIR}/config.png')
        print("   ✅ config.png")

        # Special: Discussion Templates modal
        print("\n✨ Capturing Discussion Templates modal...")
        page.keyboard.press('3')  # Go to Discussions
        time.sleep(1)
        try:
            template_btn = page.locator('button:has-text("Use Template")').first
            template_btn.click()
            time.sleep(1)
            page.screenshot(path=f'{SCREENSHOTS_DIR}/templates.png')
            print("   ✅ templates.png")
            page.keyboard.press('Escape')  # Close modal
            time.sleep(0.5)
        except Exception as e:
            print(f"   ⚠️  Templates modal not captured: {e}")

        # Special: Export dropdown (Requests tab)
        print("\n📥 Capturing Export menu...")
        page.keyboard.press('4')  # Go to Requests
        time.sleep(1)
        try:
            # Find the Export button in Requests tab (not Discussions)
            export_btns = page.locator('button:has-text("Export")').all()
            if len(export_btns) >= 2:
                # Click the second one (Requests tab)
                export_btns[1].click()
                time.sleep(0.5)
                page.screenshot(path=f'{SCREENSHOTS_DIR}/export.png')
                print("   ✅ export.png")
            else:
                page.screenshot(path=f'{SCREENSHOTS_DIR}/export.png')
                print("   ⚠️  export.png (dropdown not opened)")
        except Exception as e:
            print(f"   ⚠️  Export not captured: {e}")

        print("\n🎉 All screenshots captured successfully!")
        browser.close()

if __name__ == '__main__':
    print("=" * 60)
    print("📸 CCB Gateway Complete Screenshot Update")
    print("=" * 60)

    # Check if Gateway is running
    import requests
    try:
        resp = requests.get('http://localhost:8765/api/status', timeout=2)
        print("✅ Gateway is running\n")
    except:
        print("❌ ERROR: Gateway is not running!")
        print("\nPlease start Gateway first:")
        print("  cd ~/.local/share/codex-dual")
        print("  python3 -m lib.gateway.gateway_server --port 8765\n")
        exit(1)

    capture_all_screenshots()

    print("\n" + "=" * 60)
    print("📁 Screenshots saved to:")
    print(f"   {SCREENSHOTS_DIR}/")
    print("=" * 60)
