<?php
header('Content-Type: application/json');
session_start(); // Enable sessions

// Configuration
$ipinfoApiKey = 'cdff7b0061c7d5'; // Your IPinfo.io token
$logFile = 'api_errors.log';

// Get client IP (with Cloudflare/Proxy support)
function getClientIP()
{
    $ip = $_SERVER['REMOTE_ADDR'];
    if (isset($_SERVER['HTTP_CF_CONNECTING_IP'])) { // Cloudflare
        $ip = $_SERVER['HTTP_CF_CONNECTING_IP'];
    } elseif (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    }
    return $ip;
}

// Create session key for this IP
$clientIP = getClientIP();
$sessionKey = 'ipinfo_' . md5($clientIP);

// Check if response is already cached in session
if (isset($_SESSION[$sessionKey])) {
    die(json_encode([
        'success' => true,
        'zip' => $_SESSION[$sessionKey]['zip'],
        'source' => 'ipinfo (cached)',
        'cached' => true
    ]));
}

// Fetch from IPinfo.io API
function fetchFromIPinfo($ip, $token)
{
    $url = "https://ipinfo.io/{$ip}/json?token={$token}";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 2);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200) {
        file_put_contents(
            $logFile,
            date('Y-m-d H:i:s') . " | IP: {$ip} | Error: {$error} | Code: {$httpCode}\n",
            FILE_APPEND
        );
        return null;
    }

    return json_decode($response, true);
}

// Make API call
$data = fetchFromIPinfo($clientIP, $ipinfoApiKey);

if ($data && isset($data['postal'])) {
    // Store in session for future requests
    $_SESSION[$sessionKey] = [
        'zip' => $data['postal'],
        'timestamp' => time()
    ];

    echo json_encode([
        'success' => true,
        'zip' => $data['postal'],
        'source' => 'ipinfo',
        'cached' => false
    ]);
} else {
    file_put_contents(
        $logFile,
        date('Y-m-d H:i:s') . " | IP: {$clientIP} | Failed to get ZIP\n",
        FILE_APPEND
    );

    echo json_encode([
        'success' => false,
        'error' => 'Could not determine ZIP code',
        'ip' => $clientIP
    ]);
}
