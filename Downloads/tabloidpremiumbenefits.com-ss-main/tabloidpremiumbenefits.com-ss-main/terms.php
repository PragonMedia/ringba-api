<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Terms and Conditions</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }

        h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }

        h2 {
            color: #34495e;
            margin-top: 30px;
        }

        .date {
            font-style: italic;
            color: #7f8c8d;
            margin-bottom: 20px;
        }

        .contact {
            background-color: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #3498db;
            margin-top: 30px;
        }
    </style>
</head>

<body>
    <h1>Terms & Conditions</h1>
    <div class="date">
        <p>Last updated: January 1, 2025</p>
    </div>

    <p>These Terms and Conditions ("Terms") govern your use of our website and services. Please read these terms carefully before accessing or using our platform.</p>

    <p>By accessing or using our website, you agree to be bound by these Terms. These Terms apply to all visitors, users, and anyone who accesses or uses our services.</p>

    <p>If you do not agree with any part of these Terms, you may not access or use our services. These Terms constitute a legally binding agreement between you and our company.</p>

    <h2>Third-Party Websites and Services</h2>
    <p>Our website may contain links to external websites or services that are not owned or controlled by us.</p>

    <p>We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party websites or services. You acknowledge and agree that we shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with your use of or reliance on any such content, goods, or services available on or through any such websites or services.</p>

    <p>We strongly recommend that you review the terms and conditions and privacy policies of any third-party websites or services that you visit through links on our site.</p>

    <h2>Applicable Law</h2>
    <p>These Terms shall be interpreted and governed in accordance with the laws of Ontario, Canada, without regard to its conflict of law provisions.</p>

    <p>Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect. These Terms constitute the entire agreement between us regarding our services and supersede and replace any prior agreements we might have regarding the services.</p>

    <h2>Modifications to Terms</h2>
    <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.</p>

    <p>By continuing to access or use our services after those revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, please discontinue using our services.</p>

    <script>
        // Dynamic domain insertion script
        document.addEventListener("DOMContentLoaded", function() {
            const currentDomain = window.location.hostname;

            // Update website name (remove www if present)
            const websiteName = currentDomain.replace(/^www\./, "");
            document.getElementById("website-name").textContent = websiteName;

            // Update domain name
            document.getElementById("domain-name").textContent = currentDomain;

            // Update email domain
            document.getElementById("email-domain").textContent = currentDomain;
        });
    </script>
</body>

</html>