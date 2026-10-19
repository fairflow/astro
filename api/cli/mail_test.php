<?php
/**
 * Send one test message, to check delivery from the host (astro-tbb.8).
 * Command line only:  php ~/fairflow.co.uk/astro/api/cli/mail_test.php you@example.com
 * Needs no database. Look at where it lands (inbox or junk) and at its
 * Authentication-Results header: spf=pass, dkim=pass and dmarc=pass expected.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('ASTRO_API', 1);
require __DIR__ . '/../lib/bootstrap.php';

$to = trim($argv[1] ?? '');
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) { fwrite(STDERR, "Usage: php api/cli/mail_test.php you@example.com\n"); exit(1); }
$when = gmdate('Y-m-d H:i') . ' UTC';
$ok = send_mail($to, "Astrodynamics test message, $when",
  "This is a test message from the Astrodynamics server, sent $when.\n\n"
  . "If it reached your inbox (not junk), mail from noreply@fairflow.co.uk is being delivered.\n\n"
  . "-- \nAstrodynamics, https://fairflow.co.uk/astro/\nThis address does not receive replies.\n");
echo $ok ? "Handed to the mail server for $to\n" : "The mail server did not accept the message\n";
exit($ok ? 0 : 1);
