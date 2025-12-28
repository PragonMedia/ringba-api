<?php
// number.php - API endpoint to fetch phone number
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Function to extract domain and route from current URL
function getDomainAndRoute()
{
  // Get domain from HTTP_HOST (includes .com)
  $domain = $_SERVER['HTTP_HOST'] ?? '';

  // Remove www. prefix if present
  $domain = preg_replace('/^www\./', '', $domain);

  // Extract route from REQUEST_URI
  $requestUri = $_SERVER['REQUEST_URI'] ?? '';
  $path = parse_url($requestUri, PHP_URL_PATH);

  // Remove leading slash and get first segment
  $path = ltrim($path, '/');
  $segments = explode('/', $path);
  $route = $segments[0] ?? '';

  // If route is empty or is a PHP file, try to get from referrer
  if (empty($route) || strpos($route, '.php') !== false) {
    $referrer = $_SERVER['HTTP_REFERER'] ?? '';
    if ($referrer) {
      $referrerPath = parse_url($referrer, PHP_URL_PATH);
      $referrerPath = ltrim($referrerPath, '/');
      $referrerSegments = explode('/', $referrerPath);
      $route = $referrerSegments[0] ?? '';
    }
  }

  return ['domain' => $domain, 'route' => $route];
}

// Function to fetch route data from API
function fetchRouteData($domain, $route)
{
  $apiUrl = 'http://localhost:3000/api/v1/domain-route-details?domain=' . urlencode($domain) . '&route=' . urlencode($route);

  $ch = curl_init($apiUrl);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER => [
      'Accept: application/json',
    ],
  ]);

  $response = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $error = curl_error($ch);
  curl_close($ch);

  if ($error || $httpCode !== 200) {
    return null;
  }

  $data = json_decode($response, true);
  return $data;
}

// Extract domain and route from URL
$domainRoute = getDomainAndRoute();
$domain = $domainRoute['domain'];
$route = $domainRoute['route'];

// Fetch route data from API
$routeData = null;
$phoneNumber = "18664982822"; // Fallback default

if (!empty($domain) && !empty($route)) {
  $apiData = fetchRouteData($domain, $route);
  if ($apiData && isset($apiData['success']) && $apiData['success'] && isset($apiData['routeData']['phoneNumber'])) {
    $phoneNumber = $apiData['routeData']['phoneNumber'];
    // Remove + if present
    $phoneNumber = str_replace('+', '', $phoneNumber);
  }
}

// Log phoneNumber for testing (will be visible in response)
error_log("TESTING - phoneNumber: " . $phoneNumber);

// Return the phone number as JSON
echo json_encode([
  'success' => true,
  'phone_number' => $phoneNumber,
  'formatted_number' => '+1 (' . substr($phoneNumber, 1, 3) . ') ' . substr($phoneNumber, 4, 3) . '-' . substr($phoneNumber, 7, 4),
  'debug' => [
    'domain' => $domain,
    'route' => $route,
    'phoneNumber' => $phoneNumber
  ]
]);
