// Helper function to preserve all original URL parameters when modifying URL
// This ensures tracking parameters (bbg_*, mb, account, angle, key, channel, etc.) are never lost
function preserveUrlParams(url) {
  // Restore original parameters from sessionStorage
  const storedParams = sessionStorage.getItem("original_url_params");
  if (storedParams) {
    try {
      const originalParams = JSON.parse(storedParams);
      // Add all original parameters that aren't already in the URL
      // This preserves tracking parameters that might have been lost
      for (const [k, v] of Object.entries(originalParams)) {
        if (!url.searchParams.has(k) && v != null && v !== "") {
          url.searchParams.set(k, v);
        }
      }
    } catch (e) {
      console.error("Error preserving original params:", e);
    }
  }
  return url;
}

// Reactive phone number update function
// Called when phone button (msg17) is about to be shown
// Updates phone number if API data is available, or waits briefly for it
async function updatePhoneNumberReactive() {
  // If phone number data is already available, update immediately
  if (window.phoneNumberData && window.updatePhoneNumberInDOM) {
    window.updatePhoneNumberInDOM(
      window.phoneNumberData.phone_number,
      window.phoneNumberData.formatted_number
    );
    return;
  }

  // If promise exists but hasn't resolved yet, wait for it (with timeout)
  if (window.phoneNumberPromise) {
    try {
      // Wait up to 300ms for the promise to resolve
      await Promise.race([
        window.phoneNumberPromise,
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);

      // If data is now available, update it
      if (window.phoneNumberData && window.updatePhoneNumberInDOM) {
        window.updatePhoneNumberInDOM(
          window.phoneNumberData.phone_number,
          window.phoneNumberData.formatted_number
        );
      }
    } catch (error) {
      console.error("Error in reactive phone number update:", error);
    }
  }
}

// Function to extract domain and route from current URL
function getDomainAndRoute() {
  const url = new URL(window.location.href);
  let domain = url.hostname;

  // Remove www. prefix if present
  domain = domain.replace(/^www\./, "");

  // Extract route from pathname
  const path = url.pathname;
  const pathSegments = path
    .split("/")
    .filter((segment) => segment && !segment.includes("."));
  const route = pathSegments[0] || "";

  return { domain, route };
}

// Function to fetch route data from API
async function fetchRouteData(domain, route) {
  if (!domain || !route) {
    return null;
  }

  try {
    const apiUrl = `/api/v1/domain-route-details?domain=${encodeURIComponent(
      domain
    )}&route=${encodeURIComponent(route)}`;
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching route data:", error);
    return null;
  }
}

// Global variable to store ringbaID
let ringbaID = "CA96589cff1d5d4fa48f459da7dbd3a728"; // Fallback default

// Fetch route data on page load
(async function initRingbaID() {
  // OPTIMIZATION: Use routeConfig from single API call (set in index.html)
  // Wait a bit for routeConfig to be available
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!window.routeConfig && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (window.routeConfig && window.routeConfig.ringbaID) {
    ringbaID = window.routeConfig.ringbaID;
    console.log("ringbaID from route config (single API call):", ringbaID);
  } else {
    // Fallback: Use the function to get domain and route from URL and fetch from API
    const { domain, route } = getDomainAndRoute();

    if (domain && route) {
      const apiData = await fetchRouteData(domain, route);

      if (apiData && apiData.success && apiData.routeData) {
        // Log values from API
        if (apiData.routeData.ringbaID) {
          ringbaID = apiData.routeData.ringbaID;
          console.log("ringbaID from API (fallback):", ringbaID);
        } else {
          console.log("ringbaID from fallback:", ringbaID);
        }
      } else {
        console.log("ringbaID from fallback:", ringbaID);
      }
    } else {
      console.log("ringbaID from fallback:", ringbaID);
    }
  }
})();

// Load Ringba function - exactly as provided but as JavaScript function
const loadRingba = () => {
  var script = document.createElement("script");
  script.src = `//b-js.ringba.com/${ringbaID}`;
  let timeoutId = setTimeout(addRingbaTags, 1000);
  script.onload = function () {
    clearTimeout(timeoutId);
    addRingbaTags();
  };
  document.head.appendChild(script);
};

// Function to add tags - with age parameter and gtg added
function addRingbaTags() {
  let qualifiedValue =
    new URL(window.location.href).searchParams.get("qualified") || "unknown";
  let ageValue =
    new URL(window.location.href).searchParams.get("age") || "unknown";

  // Get gtg value from localStorage (set by gtg analysis script)
  let gtgValue = localStorage.getItem("gtg");

  // Initialize rgba_tags array if it doesn't exist
  window._rgba_tags = window._rgba_tags || [];

  // Push individual tags as separate objects
  window._rgba_tags.push({ type: "RT" });
  window._rgba_tags.push({ track_attempted: "yes" });
  window._rgba_tags.push({ qualified: qualifiedValue });
  window._rgba_tags.push({ age: ageValue });

  // Only add gtg parameter if it exists (not null/undefined)
  if (gtgValue !== null && gtgValue !== undefined && gtgValue !== "") {
    window._rgba_tags.push({ gtg: gtgValue });
  }

  console.log("Sending initial tags to Ringba:", {
    type: "RT",
    track_attempted: "yes",
    qualified: qualifiedValue,
    age: ageValue,
    gtg: gtgValue,
  });

  var intervalId = setInterval(() => {
    if (window.testData && window.testData.rtkcid !== undefined) {
      // Push click-related tags
      window._rgba_tags.push({ clickid: window.testData.rtkcid });
      window._rgba_tags.push({ qualified: qualifiedValue });
      window._rgba_tags.push({ age: ageValue });

      // Only add gtg parameter if it exists (not null/undefined)
      if (gtgValue !== null && gtgValue !== undefined && gtgValue !== "") {
        window._rgba_tags.push({ gtg: gtgValue });
      }

      console.log("Sending click tags to Ringba:", {
        clickid: window.testData.rtkcid,
        qualified: qualifiedValue,
        age: ageValue,
        gtg: gtgValue,
      });
      clearInterval(intervalId);
    }
  }, 500);
}

function startCountdown() {
  var timeLeft = 30;
  var countdownElement = document.getElementById("countdown");
  var countdownInterval = setInterval(function () {
    var minutes = Math.floor(timeLeft / 60);
    var seconds = timeLeft % 60;
    var formattedTime =
      (minutes < 10 ? "0" : "") +
      minutes +
      ":" +
      (seconds < 10 ? "0" : "") +
      seconds;
    countdownElement.innerHTML = formattedTime;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
    }
    timeLeft--;
  }, 1000);
}

function loadImages() {
  let images = document.querySelectorAll(".lazyloading");
  images.forEach((image) => {
    if (image.dataset.src) {
      image.src = image.dataset.src;
    }
  });
}

let speed = 500;

function updateAgeGroup(ageGroup) {
  let url = new URL(window.location.href);
  // Preserve all original parameters first
  url = preserveUrlParams(url);
  url.searchParams.delete("u65consumer");
  url.searchParams.delete("o65consumer");
  if (ageGroup === "under65") {
    url.searchParams.set("u65consumer", "true");
  } else if (ageGroup === "over65") {
    url.searchParams.set("o65consumer", "true");
  }
  window.history.replaceState({}, "", url);
}

let is_below = false;
let is_between = false;
let is_71plus = false;

loadImages();

setTimeout(function () {
  $("#initTyping").remove();
  $("#msg1").removeClass("hidden").after(typingEffect());
  scrollToBottom();
  setTimeout(function () {
    $(".temp-typing").remove();
    $("#msg2").removeClass("hidden").after(typingEffect());
    scrollToBottom();
    setTimeout(function () {
      $(".temp-typing").remove();
      $("#msg3").removeClass("hidden").after(typingEffect());
      scrollToBottom();
      setTimeout(function () {
        $(".temp-typing").remove();
        $("#msg_q2_2").removeClass("hidden").after(typingEffect());
        scrollToBottom();
        setTimeout(function () {
          $(".temp-typing").remove();
          $("#agentBlock_q2").removeClass("hidden");
          $("#msg_q2_3").removeClass("hidden");
          scrollToBottom();
        }, speed);
      }, speed);
    }, speed);
  }, speed);
}, speed);

var buttonValue;
var currentStep;

$("button.chat-button").on("click", function () {
  currentStep = $(this).attr("data-form-step");
  buttonValue = $(this).attr("data-form-value");

  // Step 0 and 1 removed - flow now goes directly to age selection

  if (currentStep == 2) {
    $("#msg_q2_3").addClass("hidden");
    $("#userBlock_q2").removeClass("hidden");

    var newUrl = new URL(window.location.href); // Define the URL once
    // Preserve all original parameters first
    newUrl = preserveUrlParams(newUrl);

    if (buttonValue == "below 65") {
      $("#msg_under_q2").removeClass("hidden");
      $("#hdnApprovalStatus").val("no");

      newUrl.searchParams.delete("age");
      newUrl.searchParams.set("age", "65");

      updateAgeGroup("under65");
      is_below = true;
    } else if (buttonValue == "65 - 70") {
      $("#msg_over_q2").removeClass("hidden");
      $("#hdnApprovalStatus").val("no");

      newUrl.searchParams.delete("age");
      newUrl.searchParams.set("age", "70");

      updateAgeGroup("over65");
      is_between = true;
    } else if (buttonValue == "71 - 75") {
      $("#msg_over71_q2").removeClass("hidden");

      newUrl.searchParams.delete("age");
      newUrl.searchParams.set("age", "75");

      is_71plus = true;
    } else if (buttonValue == "76 and older") {
      $("#msg_76older_q2").removeClass("hidden");

      newUrl.searchParams.delete("age");
      newUrl.searchParams.set("age", "80");

      is_71plus = true;
    }

    // Update the URL with the new age parameter
    window.history.replaceState({}, "", newUrl);

    $("#agentBlock_q3").removeClass("hidden");
    $("#agentBlock_q3 .agent-chat").prepend(typingEffect());

    scrollToBottom();
    setTimeout(function () {
      $(".temp-typing").remove();
      $("#msg_q3_1").removeClass("hidden").after(typingEffect());
      scrollToBottom();
      setTimeout(function () {
        $(".temp-typing").remove();
        $("#msg_q3_2").removeClass("hidden");
        scrollToBottom();
      }, speed);
    }, speed);
  }

  if (currentStep == 4) {
    $("#msg_insurance_2").addClass("hidden");
    $("#userBlock_insurance").removeClass("hidden");
    if (buttonValue == "Yes") {
      $("#msg_yes_insurance").removeClass("hidden");
      scrollToBottom();
      setTimeout(function () {
        $("#agentBlock4").removeClass("hidden");
        scrollToBottom();
        setTimeout(function () {
          $(".temp-typing").remove();
          $("#msg18").removeClass("hidden").after(typingEffect());
          scrollToBottom();
          setTimeout(function () {
            $(".temp-typing").remove();
            $("#disconnected").removeClass("hidden");
          }, speed);
        }, speed);
      }, speed);
      return;
    } else {
      $("#msg_no_insurance").removeClass("hidden");

      scrollToBottom();

      setTimeout(function () {
        $("#agentBlock4").removeClass("hidden");
        scrollToBottom();
        setTimeout(function () {
          $(".temp-typing").remove();
          $("#msg13").removeClass("hidden").after(typingEffect());
          scrollToBottom();
          setTimeout(function () {
            $(".temp-typing").remove();
            $("#msg14").removeClass("hidden").after(typingEffect());
            scrollToBottom();
            setTimeout(function () {
              $(".temp-typing").remove();
              $("#msg15").removeClass("hidden").after(typingEffect());
              scrollToBottom();
              setTimeout(function () {
                $(".temp-typing").remove();
                $("#msg16").removeClass("hidden").after(typingEffect());
                scrollToBottom();
                setTimeout(function () {
                  $(".temp-typing").remove();
                  $("#msg17").before(typingEffect());
                  scrollToBottom();
                  setTimeout(function () {
                    $(".temp-typing").remove();
                    // Update phone number reactively before showing button
                    updatePhoneNumberReactive();
                    $("#msg17").removeClass("hidden");
                    scrollToBottom();
                    startCountdown();
                  }, 500);
                }, speed);
              }, speed);
            }, speed);
          }, speed);
        }, speed);
      }, speed);
    }
  }

  if (currentStep == 3) {
    $("#agentBlock4 .agent-chat").prepend(typingEffect());
    $("#msg_q3_2").addClass("hidden");
    $("#userBlock_q3").removeClass("hidden");

    var newUrl = new URL(window.location.href); // Define the URL once
    // Preserve all original parameters first
    newUrl = preserveUrlParams(newUrl);

    if (buttonValue == "Yes") {
      $("#msg_yes_q3").removeClass("hidden");

      newUrl.searchParams.delete("qualified");
      newUrl.searchParams.set("qualified", "yes");
    } else if (buttonValue == "No") {
      $("#msg_no_q3").removeClass("hidden");

      newUrl.searchParams.delete("qualified");
      newUrl.searchParams.set("qualified", "no");

      // Build CLAIM NOW button URL with clickID and mb parameters
      const clickID =
        localStorage.getItem("rt_clickid") ||
        newUrl.searchParams.get("clickid") ||
        "";
      const mbParam = newUrl.searchParams.get("mb") || "";
      // Only set iframe URL if gtg is not "1" (will be shown later based on gtg value)
      const gtgValue = localStorage.getItem("gtg");
      if (gtgValue !== "1") {
        const claimNowIframeUrl = `https://policyfinds.com/sq1/claim-button.html?clickid=${encodeURIComponent(
          clickID
        )}&mb=${encodeURIComponent(mbParam)}`;

        // Set the src for the claim now iframe
        const claimNowIframe = document.getElementById("claim-now-iframe");
        if (claimNowIframe) {
          claimNowIframe.src = claimNowIframeUrl;
        }
      }
    }

    // Load Ringba and call addRingbaTags after qualification
    setTimeout(() => {
      loadRingba();
    }, 100);
    scrollToBottom();

    setTimeout(function () {
      $("#agentBlock4").removeClass("hidden");
      scrollToBottom();
      setTimeout(function () {
        $(".temp-typing").remove();
        $("#msg13").removeClass("hidden").after(typingEffect());
        scrollToBottom();
        setTimeout(function () {
          $(".temp-typing").remove();
          $("#msg14").removeClass("hidden").after(typingEffect());
          scrollToBottom();
          setTimeout(function () {
            $(".temp-typing").remove();
            // Show different message based on Yes/No answer
            if (buttonValue == "Yes") {
              $("#msg15").removeClass("hidden").after(typingEffect());
            } else if (buttonValue == "No") {
              $("#msg15_no").removeClass("hidden").after(typingEffect());
            }
            scrollToBottom();
            setTimeout(function () {
              $(".temp-typing").remove();
              // Show phone button for "Yes", CLAIM NOW button for "No"
              if (buttonValue == "Yes") {
                $("#msg17").before(typingEffect());
                scrollToBottom();
                setTimeout(function () {
                  $(".temp-typing").remove();
                  // Update phone number reactively before showing button
                  updatePhoneNumberReactive();
                  $("#msg17").removeClass("hidden");
                  scrollToBottom();
                  startCountdown();
                }, 500);
              } else if (buttonValue == "No") {
                // Get gtg value from localStorage
                const gtgValue = localStorage.getItem("gtg");

                // If gtg is "1", show contact page button
                // If gtg is "0" or null/undefined, show iframe button
                if (gtgValue === "1") {
                  // Show contact page button
                  $("#msg19-contact").removeClass("hidden");
                } else {
                  // Show iframe button (gtg is "0" or null/undefined)
                  const currentUrl = new URL(window.location.href);
                  // Preserve all original parameters
                  preserveUrlParams(currentUrl);
                  const clickID =
                    localStorage.getItem("rt_clickid") ||
                    currentUrl.searchParams.get("clickid") ||
                    "";
                  const mbParam = currentUrl.searchParams.get("mb") || "";
                  const claimNowIframeUrl = `https://policyfinds.com/sq1/claim-button.html?clickid=${encodeURIComponent(
                    clickID
                  )}&mb=${encodeURIComponent(mbParam)}`;

                  // Set the src for the claim now iframe
                  const claimNowIframe =
                    document.getElementById("claim-now-iframe");
                  if (claimNowIframe) {
                    claimNowIframe.src = claimNowIframeUrl;
                  }
                  // Show the claim now container (inside chat bubble)
                  $("#msg19").removeClass("hidden");
                }
                startCountdown();
              }
              scrollToBottom();
            }, speed);
          }, speed);
        }, speed);
      }, speed);
    }, speed);

    // Update the URL with the new qualified parameter
    window.history.replaceState({}, "", newUrl);
  }
});

function scrollToBottom() {
  var object = $("main");
  $("html, body").animate(
    {
      scrollTop:
        object.offset().top + object.outerHeight() - $(window).height(),
    },
    "fast"
  );
}

function typingEffect() {
  string =
    '<div class="temp-typing bg-gray-200 p-3 rounded-lg shadow-xs mt-2 inline-block">';
  string += '<div class="typing-animation">';
  string += '<div class="typing-dot"></div>';
  string += '<div class="typing-dot"></div>';
  string += '<div class="typing-dot"></div>';
  string += "</div>";
  string += "</div>";
  return string;
}

let userId = localStorage.getItem("user_id");
if (!userId) {
  userId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  localStorage.setItem("user_id", userId);
}

// Google Ads conversion tracking function
function gtag_report_conversion(url) {
  console.log("Google Tag Manager conversion event fired", {
    url: url,
    send_to: "AW-16921817895/4s4iCJv-wb8bEKfm-YQ_",
  });
  var callback = function () {
    if (typeof url != "undefined") {
      window.location = url;
    }
  };
  gtag("event", "conversion", {
    send_to: "AW-16921817895/4s4iCJv-wb8bEKfm-YQ_",
    value: 1.0,
    currency: "USD",
    event_callback: callback,
  });
  return false;
}

// Function to attach click listener to phone button
// MUTED FOR TESTING - Check for double firing
// function attachPhoneButtonListener() {
//   const phoneButton = document.getElementById("phone-number");
//   if (phoneButton && !phoneButton.hasAttribute("data-gtag-listener-attached")) {
//     // Attach the click event listener
//     phoneButton.addEventListener("click", function (e) {
//       const href = this.getAttribute("href");
//       if (href) {
//         // Execute existing onclick handler if present (for fbq tracking)
//         // MUTED FOR TESTING - Check for double firing
//         // const existingOnclick = this.getAttribute("onclick");
//         // if (existingOnclick) {
//         //   try {
//         //     eval(existingOnclick);
//         //   } catch (err) {
//         //     console.error("Error executing existing onclick:", err);
//         //   }
//         // }

//         // Check if user answered "No" to Medicare Part A and Part B question
//         const qualifiedParam = new URL(window.location.href).searchParams.get(
//           "qualified"
//         );

//         // For tel: links, allow default behavior (phone dialer opens)
//         // Don't prevent default so the link works normally
//         if (href.startsWith("tel:")) {
//           // Track conversion without preventing default
//           // MUTED FOR TESTING - Check for double firing
//           // if (qualifiedParam !== "no" && typeof gtag === "function") {
//           //   gtag("event", "conversion", {
//           //     send_to: "AW-16921817895/4s4iCJv-wb8bEKfm-YQ_",
//           //     value: 1.0,
//           //     currency: "USD",
//           //   });
//           // }

//           // Allow the tel: link to work normally (don't prevent default)
//           return;
//         }

//         // For non-tel links, handle navigation
//         e.preventDefault();
//         if (qualifiedParam === "no") {
//           console.log(
//             "Google Tag Manager conversion blocked: User answered 'No' to Medicare Part A and Part B question"
//           );
//           window.location = href;
//           return;
//         }

//         // Call gtag conversion tracking for non-tel links
//         if (typeof gtag_report_conversion === "function") {
//           gtag_report_conversion(href);
//         }
//       }
//     });

//     // Mark as attached to avoid duplicates
//     phoneButton.setAttribute("data-gtag-listener-attached", "true");
//     return true; // Successfully attached
//   }
//   return false; // Button not found yet or already attached
// }

// Try to attach listener when DOM is ready
// MUTED FOR TESTING - Check for double firing
// if (document.readyState === "loading") {
//   document.addEventListener("DOMContentLoaded", function () {
//     attachPhoneButtonListener();
//   });
// } else {
//   // DOM already loaded, try to attach immediately
//   attachPhoneButtonListener();
// }

// Use MutationObserver to watch for when the button becomes visible
// This handles the case where the button is initially hidden
// MUTED FOR TESTING - Check for double firing
// const observer = new MutationObserver(function (mutations) {
//   mutations.forEach(function (mutation) {
//     // Check for when msg17 (parent container) becomes visible
//     if (mutation.type === "attributes" && mutation.attributeName === "class") {
//       const msg17 = document.getElementById("msg17");
//       if (msg17 && !msg17.classList.contains("hidden")) {
//         // Parent is now visible, try to attach listener to phone button
//         attachPhoneButtonListener();
//       }
//     }
//     // Also check for childList changes in case button is added dynamically
//     if (mutation.type === "childList") {
//       attachPhoneButtonListener();
//     }
//   });
// });

// Start observing when DOM is ready
// MUTED FOR TESTING - Check for double firing
// if (document.readyState === "loading") {
//   document.addEventListener("DOMContentLoaded", function () {
//     const msg17 = document.getElementById("msg17");
//     if (msg17) {
//       observer.observe(msg17, {
//         attributes: true,
//         attributeFilter: ["class"],
//         childList: true,
//         subtree: true,
//       });
//     }
//   });
// } else {
//   const msg17 = document.getElementById("msg17");
//   if (msg17) {
//     observer.observe(msg17, {
//       attributes: true,
//       attributeFilter: ["class"],
//       childList: true,
//       subtree: true,
//     });
//   }
// }
