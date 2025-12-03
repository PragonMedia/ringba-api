// Load Ringba function - exactly as provided but as JavaScript function
const loadRingba = () => {
  var script = document.createElement("script");
  script.src = "//b-js.ringba.com/CAd4c016a37829477688c3482fb6fd01de";
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
        $("#msg4").removeClass("hidden");
      }, speed);
    }, speed);
  }, speed);
}, speed);

var buttonValue;
var currentStep;

$("button.chat-button").on("click", function () {
  currentStep = $(this).attr("data-form-step");
  buttonValue = $(this).attr("data-form-value");

  if (currentStep == 1 || currentStep == 0) {
    $("#msg4").addClass("hidden");
    $("#userBlock1").removeClass("hidden");
    $("#agentBlock_q2").removeClass("hidden");
    $("#agentBlock_q2 .agent-chat").prepend(typingEffect());
    $("#msg_yes_q2").removeClass("hidden");
    scrollToBottom();
    setTimeout(function () {
      $(".temp-typing").remove();
      $("#msg_q2_1").removeClass("hidden").after(typingEffect());
      scrollToBottom();
      setTimeout(function () {
        $(".temp-typing").remove();
        $("#msg_q2_2").removeClass("hidden").after(typingEffect());
        scrollToBottom();
        setTimeout(function () {
          $(".temp-typing").remove();
          $("#msg_q2_3").removeClass("hidden");
          scrollToBottom();
        }, speed);
      }, speed);
    }, speed);
  }

  if (currentStep == 2) {
    $("#msg_q2_3").addClass("hidden");
    $("#userBlock_q2").removeClass("hidden");

    var newUrl = new URL(window.location.href); // Define the URL once

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
                  $("#msg17").removeClass("hidden");
                  scrollToBottom();
                  startCountdown();
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

    if (buttonValue == "Yes") {
      $("#msg_yes_q3").removeClass("hidden");

      newUrl.searchParams.delete("qualified");
      newUrl.searchParams.set("qualified", "yes");
    } else if (buttonValue == "No") {
      $("#msg_no_q3").removeClass("hidden");

      newUrl.searchParams.delete("qualified");
      newUrl.searchParams.set("qualified", "no");
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
            $("#msg15").removeClass("hidden").after(typingEffect());
            scrollToBottom();
            setTimeout(function () {
              $(".temp-typing").remove();
              $("#msg16").removeClass("hidden").after(typingEffect());
              scrollToBottom();
              setTimeout(function () {
                $(".temp-typing").remove();
                $("#msg17").removeClass("hidden");
                scrollToBottom();
                startCountdown();
              }, speed);
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
function attachPhoneButtonListener() {
  const phoneButton = document.getElementById("phone-number");
  if (phoneButton && !phoneButton.hasAttribute("data-gtag-listener-attached")) {
    // Attach the click event listener
    phoneButton.addEventListener("click", function (e) {
      e.preventDefault();
      const href = this.getAttribute("href");
      if (href) {
        // Execute existing onclick handler if present (for fbq tracking)
        const existingOnclick = this.getAttribute("onclick");
        if (existingOnclick) {
          try {
            eval(existingOnclick);
          } catch (err) {
            console.error("Error executing existing onclick:", err);
          }
        }

        // Check if user answered "No" to Medicare Part A and Part B question
        // If they answered "No", prevent Google Tag Manager from firing
        const qualifiedParam = new URL(window.location.href).searchParams.get(
          "qualified"
        );
        if (qualifiedParam === "no") {
          console.log(
            "Google Tag Manager conversion blocked: User answered 'No' to Medicare Part A and Part B question"
          );
          // Still allow the phone link to work, just skip conversion tracking
          window.location = href;
          return;
        }

        // Call gtag conversion tracking only if user answered "Yes" or parameter is not set
        gtag_report_conversion(href);
      }
    });

    // Mark as attached to avoid duplicates
    phoneButton.setAttribute("data-gtag-listener-attached", "true");
    return true; // Successfully attached
  }
  return false; // Button not found yet or already attached
}

// Try to attach listener when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    attachPhoneButtonListener();
  });
} else {
  // DOM already loaded, try to attach immediately
  attachPhoneButtonListener();
}

// Use MutationObserver to watch for when the button becomes visible
// This handles the case where the button is initially hidden
const observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    // Check for when msg17 (parent container) becomes visible
    if (mutation.type === "attributes" && mutation.attributeName === "class") {
      const msg17 = document.getElementById("msg17");
      if (msg17 && !msg17.classList.contains("hidden")) {
        // Parent is now visible, try to attach listener to phone button
        attachPhoneButtonListener();
      }
    }
    // Also check for childList changes in case button is added dynamically
    if (mutation.type === "childList") {
      attachPhoneButtonListener();
    }
  });
});

// Start observing when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    const msg17 = document.getElementById("msg17");
    if (msg17) {
      observer.observe(msg17, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true,
      });
    }
  });
} else {
  const msg17 = document.getElementById("msg17");
  if (msg17) {
    observer.observe(msg17, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });
  }
}
