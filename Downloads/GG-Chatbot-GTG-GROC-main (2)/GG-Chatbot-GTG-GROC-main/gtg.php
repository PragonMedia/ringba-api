<?php
// gtg.php - Traffic analysis and referrer tracking
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');


// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Start session for referrer tracking
if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

// Configuration
const SESSION_KEY = 'referrers';
const SESSION_TTL = 24 * 3600; // 24 hours

// Target referrers (competitor/spy tools)
$targetReferrers = [
  "adspy.com",
  "bigspy.com",
  "minea.com",
  "adspyder.io",
  "adflex.io",
  "poweradspy.com",
  "dropispy.com",
  "socialpeta.com",
  "adstransparency.google.com",
  "facebook.com/ads/library",
  "adbeat.com",
  "anstrex.com",
  "semrush.com",
  "autods.com",
  "foreplay.co",
  "spyfu.com",
  "adplexity.com",
  "spypush.com",
  "nativeadbuzz.com",
  "spyover.com",
  "videoadvault.com",
  "admobispy.com",
  "ispionage.com",
  "similarweb.com",
  "pipiads.com",
  "adespresso.com",
];

// Get current referrer
$currentReferrer = $_SERVER['HTTP_REFERER'] ?? '';

// Get referrers from session or initialize empty array
$referrers = $_SESSION[SESSION_KEY] ?? [];

// Don't add the current URL as a referrer if we're accessing gtg.php directly
$currentUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
$isDirectAccess = strpos($currentReferrer, $_SERVER['HTTP_HOST']) !== false;

// If there's a referrer and it's not already in the array, and it's not a direct access to our own domain, add it
if ($currentReferrer && !in_array($currentReferrer, $referrers) && !$isDirectAccess) {
  $referrers[] = $currentReferrer;
  $_SESSION[SESSION_KEY] = $referrers;
}

// Always treat the first one as the original referrer
$originalReferrer = $referrers[0] ?? '';

// Check if user came from spy/competitor site
$cameFromReferrer = false;
if ($originalReferrer) {
  try {
    $parsedUrl = parse_url($originalReferrer);
    $hostname = $parsedUrl['host'] ?? '';

    foreach ($targetReferrers as $domain) {
      if (strpos($hostname, $domain) !== false) {
        $cameFromReferrer = true;
        break;
      }
    }
  } catch (Exception $e) {
    $cameFromReferrer = false;
  }
}

// Check if user has the correct key parameter
$hasKey = false;
$keyParam = '';

// Try to get key from $_GET first
if (isset($_GET['key'])) {
  $keyParam = $_GET['key'];
  $hasKey = strtoupper(trim($keyParam)) === 'X184GA';
} else {
  // If $_GET doesn't work, try parsing QUERY_STRING directly
  $queryString = $_SERVER['QUERY_STRING'] ?? '';
  if ($queryString) {
    parse_str($queryString, $parsedParams);
    if (isset($parsedParams['key'])) {
      $keyParam = $parsedParams['key'];
      $hasKey = strtoupper(trim($keyParam)) === 'X184GA';
    }
  }

  // If still no key, try to extract from referrer URL
  if (!$hasKey && $currentReferrer) {
    $referrerUrl = parse_url($currentReferrer);
    if (isset($referrerUrl['query'])) {
      parse_str($referrerUrl['query'], $referrerParams);
      if (isset($referrerParams['key'])) {
        $keyParam = $referrerParams['key'];
        $hasKey = strtoupper(trim($keyParam)) === 'X184GA';
      }
    }
  }
}

// Get clickid parameter for failed verification
$clickidParam = '';

// Try to get clickid from $_GET first
if (isset($_GET['clickid'])) {
  $clickidParam = $_GET['clickid'];
} else {
  // If $_GET doesn't work, try parsing QUERY_STRING directly
  $queryString = $_SERVER['QUERY_STRING'] ?? '';
  if ($queryString) {
    parse_str($queryString, $parsedParams);
    if (isset($parsedParams['clickid'])) {
      $clickidParam = $parsedParams['clickid'];
    }
  }

  // If still no clickid, try to extract from referrer URL
  if (!$clickidParam && $currentReferrer) {
    $referrerUrl = parse_url($currentReferrer);
    if (isset($referrerUrl['query'])) {
      parse_str($referrerUrl['query'], $referrerParams);
      if (isset($referrerParams['clickid'])) {
        $clickidParam = $referrerParams['clickid'];
      }
    }
  }
}

// Determine gtg value based on analysis logic
$gtg = null; // Default to legitimate traffic

// Logic:
// gtg=1 if user came from spy referrer OR doesn't have "key=X184GA"
// If they pass all tests, don't send gtg to Ringba (gtg=null)

if ($cameFromReferrer || !$hasKey) {
  $gtg = 1; // Invalid traffic - set gtg=1
} else {
  $gtg = null; // Legitimate traffic - don't send gtg parameter
}

// Return analysis result
echo json_encode([
  'success' => true,
  'gtg' => $gtg,
  'cameFromReferrer' => $cameFromReferrer,
  'hasKey' => $hasKey,
  'clickid' => $clickidParam,
  'originalReferrer' => $originalReferrer,
  'currentReferrer' => $currentReferrer,
  'referrers' => $referrers,
  'gtgTraffic' => ($gtg === null),
  'urlUpdated' => ($gtg !== null),
]);
