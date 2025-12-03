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

// For now, hardcoded phone number - in the future this will make an API call to a server
$phoneNumber = "18664982822";

// Return the phone number as JSON
echo json_encode([
  'success' => true,
  'phone_number' => $phoneNumber,
  'formatted_number' => '+1 (' . substr($phoneNumber, 1, 3) . ') ' . substr($phoneNumber, 4, 3) . '-' . substr($phoneNumber, 7, 4)
]);
