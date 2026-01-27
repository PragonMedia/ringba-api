<?php

$domain = $_SERVER['SERVER_NAME'];

?>
<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta http-equiv="Content-Type" content="text/html;charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Us</title>
    <script src="https://unpkg.com/@tailwindcss/browser@4"></script>
    <style>
        .contact-card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            max-width: 600px;
            margin: 2rem auto;
            overflow: hidden;
        }

        .contact-header {
            background: #f8f9fa;
            padding: 1.5rem;
            text-align: center;
            border-bottom: 1px solid #e5e7eb;
        }

        .contact-title {
            font-size: 1.875rem;
            font-weight: bold;
            color: #374151;
            margin: 0;
        }

        .contact-form {
            padding: 2rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-row {
            display: flex;
            gap: 1rem;
        }

        .form-row .form-group {
            flex: 1;
            margin-bottom: 0;
        }

        .form-label {
            display: block;
            color: #374151;
            font-weight: 500;
            margin-bottom: 0.5rem;
        }

        .required {
            color: #dc2626;
        }

        .form-input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 1rem;
            transition: border-color 0.2s;
        }

        .form-input:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-textarea {
            resize: vertical;
            min-height: 120px;
        }

        .submit-btn {
            background: #374151;
            color: white;
            padding: 0.75rem 2rem;
            border: none;
            border-radius: 4px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            display: block;
            margin: 0 auto;
        }

        .submit-btn:hover {
            background: #1f2937;
        }

        .back-link {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 1rem 0 0 1rem;
            font-size: 0.875rem;
        }

        .back-link:hover {
            background: #2563eb;
        }
    </style>
</head>

<body style="background-color: #f3f4f6; min-height: 100vh;">

    <a href="./index.html" class="back-link">← Back</a>

    <div class="contact-card">
        <div class="contact-header">
            <h1 class="contact-title">Contact Us</h1>
        </div>

        <form class="contact-form" action="#" method="POST">
            <div class="form-row">
                <div class="form-group">
                    <label for="firstName" class="form-label">First Name <span class="required">*</span></label>
                    <input type="text" id="firstName" name="firstName" class="form-input" required>
                </div>
                <div class="form-group">
                    <label for="lastName" class="form-label">Last Name <span class="required">*</span></label>
                    <input type="text" id="lastName" name="lastName" class="form-input" required>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="email" class="form-label">E-mail <span class="required">*</span></label>
                    <input type="email" id="email" name="email" class="form-input" required>
                </div>
                <div class="form-group">
                    <label for="phone" class="form-label">Phone <span class="required">*</span></label>
                    <input type="tel" id="phone" name="phone" class="form-input" required>
                </div>
            </div>

            <div class="form-group">
                <label for="message" class="form-label">Message <span class="required">*</span></label>
                <textarea id="message" name="message" class="form-input form-textarea" required></textarea>
            </div>

            <button type="submit" class="submit-btn">Submit</button>
        </form>
    </div>

    <footer class="bg-gray-100 border-t border-t-1 border-t-gray-200 mt-8">
        <div
            class="mx-auto max-w-7xl overflow-hidden px-6 py-8 lg:px-8 text-sm sm:text-md leading-5 sm:leading-6 text-gray-500" style="display: flex;justify-content: space-evenly;align-items: center;">
            <p>@2025. All rights Reserved. </p>
            <p class="text-center text-blue-400">
                <span>
                    <a href="./privacy.php" target="_blank">Privacy Policy</a> |
                    <a href="./terms.php" target="_blank">Terms &amp; Conditions</a> |
                    <a href="./contact.php" target="_blank">Contact Us</a>
                </span>
            </p>
        </div>
    </footer>

</body>

</html>