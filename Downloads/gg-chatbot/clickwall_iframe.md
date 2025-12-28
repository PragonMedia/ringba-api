# Instructions: How to Embed Insurance Clickwall Iframe

## Overview

You need to embed an iframe that displays insurance ads from the API. The iframe is hosted at `https://policyfinds.com/sq1` and will automatically fetch and display ads based on the `mb` parameter.

---

## Step-by-Step Implementation

### 1. Add the HTML Container

Add this HTML structure to your landing page where you want the clickwall to appear:

```html
<!-- Clickwall Container - Hidden by default -->
<div id="click-wall-container" style="display: none; margin-top: 20px">
  <div class="bg-gray-200 p-3 rounded-lg shadow-xs mt-2">
    <h3 class="text-lg font-bold text-gray-800 mb-2">Compare Medicare Plans</h3>
    <p class="text-md text-gray-800 mb-3">
      Select a carrier below to compare plans and get your benefits:
    </p>

    <!-- Loading Spinner -->
    <div id="loading-ads" style="text-align: center; padding: 30px">
      <div
        style="
        display: inline-block;
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "
      ></div>
      <p style="margin-top: 15px; color: #666; font-size: 14px">
        Loading insurance options...
      </p>
    </div>

    <!-- Iframe - Hidden initially -->
    <iframe
      id="mao-iframe"
      src=""
      style="width: 100%; height: 400px; border: none; display: none"
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
    ></iframe>

    <!-- Error Message - Hidden by default -->
    <div
      id="error-message"
      style="
        display: none;
        text-align: center;
        padding: 30px;
        color: #e74c3c;
      "
    >
      <p style="font-size: 16px; font-weight: bold">
        Unable to load insurance options
      </p>
      <p style="margin-top: 10px; font-size: 14px">
        Please refresh the page or contact support.
      </p>
    </div>
  </div>
</div>
```

### 2. Add CSS for Spinner Animation

Add this CSS to your page (in `<style>` tag or external CSS file):

```css
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
```

### 3. Add JavaScript Function

Add this JavaScript function to handle showing the clickwall:

```javascript
// Function to show the clickwall iframe
function showClickWall() {
  const clickWallContainer = document.getElementById("click-wall-container");
  const iframe = document.getElementById("mao-iframe");
  const loadingAds = document.getElementById("loading-ads");
  const errorMessage = document.getElementById("error-message");

  if (!clickWallContainer || !iframe || !loadingAds) {
    console.error("Clickwall elements not found");
    return;
  }

  // Get mb parameter from current page URL
  const urlParams = new URLSearchParams(window.location.search);
  const mbValue = urlParams.get("mb") || "";

  // Show the click wall container
  clickWallContainer.style.display = "block";

  // Show loading spinner, hide iframe and error
  loadingAds.style.display = "block";
  iframe.style.display = "none";
  errorMessage.style.display = "none";

  // Build iframe URL with mb parameter
  const iframeUrl = `https://policyfinds.com/sq1${
    mbValue ? `?mb=${encodeURIComponent(mbValue)}` : ""
  }`;

  // Set iframe source
  iframe.src = iframeUrl;

  // When iframe loads successfully
  iframe.onload = () => {
    loadingAds.style.display = "none";
    iframe.style.display = "block";
  };

  // Handle iframe load errors
  iframe.onerror = () => {
    loadingAds.style.display = "none";
    errorMessage.style.display = "block";
  };
}
```

### 4. Trigger the Clickwall

Call `showClickWall()` when you want to display the ads. Common triggers:

#### Option A: After Button Click (with delay)

```javascript
document.getElementById("phone-button").addEventListener("click", () => {
  // Show clickwall 5 seconds after phone button click
  setTimeout(() => {
    showClickWall();
  }, 5000);
});
```

#### Option B: After Form Submission

```javascript
document.getElementById("my-form").addEventListener("submit", (e) => {
  e.preventDefault();
  // Show clickwall after form submission
  setTimeout(() => {
    showClickWall();
  }, 1000);
});
```

#### Option C: On Page Load (with delay)

```javascript
window.addEventListener("load", () => {
  // Show clickwall 3 seconds after page loads
  setTimeout(() => {
    showClickWall();
  }, 3000);
});
```

#### Option D: After User Scrolls

```javascript
let clickwallShown = false;
window.addEventListener("scroll", () => {
  if (!clickwallShown && window.scrollY > 500) {
    clickwallShown = true;
    showClickWall();
  }
});
```

---

## Complete Example

Here's a complete working example:

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    </style>
  </head>
  <body>
    <!-- Your landing page content -->
    <h1>Welcome to My Landing Page</h1>
    <button id="phone-button">Call Now</button>

    <!-- Clickwall Container -->
    <div id="click-wall-container" style="display: none; margin-top: 20px">
      <div class="bg-gray-200 p-3 rounded-lg shadow-xs mt-2">
        <h3 class="text-lg font-bold text-gray-800 mb-2">
          Compare Medicare Plans
        </h3>
        <p class="text-md text-gray-800 mb-3">
          Select a carrier below to compare plans and get your benefits:
        </p>

        <div id="loading-ads" style="text-align: center; padding: 30px">
          <div
            style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"
          ></div>
          <p style="margin-top: 15px; color: #666; font-size: 14px">
            Loading insurance options...
          </p>
        </div>

        <iframe
          id="mao-iframe"
          src=""
          style="width: 100%; height: 400px; border: none; display: none"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
        ></iframe>

        <div
          id="error-message"
          style="display: none; text-align: center; padding: 30px; color: #e74c3c;"
        >
          <p style="font-size: 16px; font-weight: bold">
            Unable to load insurance options
          </p>
          <p style="margin-top: 10px; font-size: 14px">
            Please refresh the page or contact support.
          </p>
        </div>
      </div>
    </div>

    <script>
      function showClickWall() {
        const clickWallContainer = document.getElementById(
          "click-wall-container"
        );
        const iframe = document.getElementById("mao-iframe");
        const loadingAds = document.getElementById("loading-ads");
        const errorMessage = document.getElementById("error-message");

        if (!clickWallContainer || !iframe || !loadingAds) return;

        const urlParams = new URLSearchParams(window.location.search);
        const mbValue = urlParams.get("mb") || "";

        clickWallContainer.style.display = "block";
        loadingAds.style.display = "block";
        iframe.style.display = "none";
        errorMessage.style.display = "none";

        iframe.src = `https://policyfinds.com/sq1${
          mbValue ? `?mb=${encodeURIComponent(mbValue)}` : ""
        }`;

        iframe.onload = () => {
          loadingAds.style.display = "none";
          iframe.style.display = "block";
        };

        iframe.onerror = () => {
          loadingAds.style.display = "none";
          errorMessage.style.display = "block";
        };
      }

      // Trigger: Show clickwall 5 seconds after phone button click
      document.getElementById("phone-button").addEventListener("click", () => {
        setTimeout(showClickWall, 5000);
      });
    </script>
  </body>
</html>
```

---

## How It Works

1. **User visits landing page**: `mywebsite.com?mb=JH`
2. **User triggers action**: Clicks button, submits form, etc.
3. **JavaScript extracts `mb` parameter**: Gets `JH` from URL
4. **Shows clickwall container**: Displays loading spinner
5. **Loads iframe**: Points to `https://policyfinds.com/sq1?mb=JH`
6. **Iframe makes API call**: Sends `{ ni_var1: "JH" }` to NextInsure API
7. **Ads display**: Insurance listings appear in the iframe

---

## Important Notes

- ✅ The `mb` parameter is automatically extracted from your landing page URL
- ✅ The iframe is hosted at `https://policyfinds.com/sq1` (already deployed)
- ✅ The iframe handles all API calls and ad rendering automatically
- ✅ Make sure to include the spinner animation CSS
- ✅ Test with different `mb` values: `?mb=JH`, `?mb=TEST123`, etc.

---

## Troubleshooting

**If ads don't show:**

1. Check browser console for errors
2. Verify `mb` parameter is in the URL
3. Test iframe URL directly: `https://policyfinds.com/sq1?mb=TEST`
4. Check network tab to see if API call is being made

**If iframe is blank:**

1. Check if `policyfinds.com/sq1` is accessible
2. Verify CORS settings allow embedding
3. Check browser console for iframe errors
