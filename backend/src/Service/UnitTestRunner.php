<?php
/**
 * UnitTestRunner
 * Simple HTTP-based assertions runner without external dependencies.
 */
namespace App\Service;

/**
 * Executes simple HTTP-based "unit" tests defined as JSON objects.
 * Test shape:
 * [
 *   {
 *     "name": "GET dashboard returns 200",
 *     "method": "GET",
 *     "url": "/",
 *     "headers": {"Accept":"text/html"},
 *     "body": null,
 *     "assert": { "status": 200, "contains": "Functional Tester" }
 *   }
 * ]
 */
class UnitTestRunner
{
    private string $baseUrl;

    public function __construct(?string $baseUrl = null)
    {
        $this->baseUrl = $baseUrl ?? ($_ENV['APP_BASE_URL'] ?? 'http://web');
    }

    /**
     * @param array $tests
     * @return array{success:bool, total:int, passed:int, failed:int, cases:array}
     */
    public function run(array $tests): array
    {
        $cases = [];
        $passed = 0; $failed = 0;
        // Simple cookie jar shared across tests to allow multi-step flows
        $cookieJar = [];
        // Context variables captured from responses
        $vars = [];
        foreach ($tests as $i => $t) {
            $name = (string)($t['name'] ?? ('Test #'.$i));
            $method = strtoupper((string)($t['method'] ?? 'GET'));
            $url = (string)($t['url'] ?? '/');
            $full = $this->toAbsoluteUrl($url);
            $headers = (array)($t['headers'] ?? []);
            $body = $t['body'] ?? null;
            $assert = (array)($t['assert'] ?? []);
            $started = microtime(true);
            $ok = true; $err = null; $status = null; $text = '';
            try {
                // Template URL, headers and body with {{var}}
                $full = $this->templateString($full, $vars);
                $headers = $this->templateArray($headers, $vars);
                if (is_array($body)) { $body = $this->templateArray($body, $vars); }
                if (is_string($body)) { $body = $this->templateString($body, $vars); }

                $payload = is_array($body) ? json_encode($body) : (is_string($body) ? $body : null);
                $res = $this->simpleRequest($method, $full, $headers, $payload, $cookieJar);
                $status = $res['status'];
                $text = $res['body'];
                // Assertions
                if (isset($assert['status']) && (int)$assert['status'] !== $status) {
                    $ok = false; $err = 'Expected status '.$assert['status'].' got '.$status;
                }
                if ($ok && isset($assert['contains'])) {
                    $needle = $this->templateString((string)$assert['contains'], $vars);
                    if (strpos($text, $needle) === false) { $ok = false; $err = 'Body does not contain "'.$needle.'"'; }
                }
                if ($ok && isset($assert['json'])) {
                    $json = json_decode($text, true);
                    if ($json === null) { $ok = false; $err = 'Response is not JSON'; }
                    else {
                        $path = (string)($assert['json']['path'] ?? '');
                        $val = $this->dotGet($json, $path);
                        // Determine expected value
                        $expected = $assert['json']['equals'] ?? null;
                        if (array_key_exists('equalsVar', $assert['json'])) {
                            $varName = (string)$assert['json']['equalsVar'];
                            $expected = $vars[$varName] ?? null;
                        }
                        if (array_key_exists('equalsExpr', $assert['json'])) {
                            $expr = (string)$assert['json']['equalsExpr'];
                            $calc = $this->evalArithmetic($expr, $vars);
                            $expected = $calc;
                        }
                        if ($val !== $expected) { $ok = false; $err = 'JSON path '.$path.' does not equal expected'; }
                    }
                }

                // Captures (after assertions or regardless?) — we capture regardless of assert outcome
                if (isset($t['capture'])) {
                    $captures = is_array($t['capture']) && array_is_list($t['capture']) ? $t['capture'] : [$t['capture']];
                    $this->applyCaptures($captures, $text, $res['headers'] ?? [], $vars);
                }
            } catch (\Throwable $e) {
                $ok = false; $err = $e->getMessage();
            }
            $dur = (int)round((microtime(true) - $started) * 1000);
            $cases[] = [
                'name' => $name,
                'method' => $method,
                'url' => $full,
                'status' => $status,
                'ok' => $ok,
                'error' => $err,
                'durationMs' => $dur,
            ];
            if ($ok) $passed++; else $failed++;
        }
        return ['success' => $failed === 0, 'total' => count($cases), 'passed' => $passed, 'failed' => $failed, 'cases' => $cases];
    }

    /**
     * Tiny dependency-free HTTP request using PHP streams.
     * Returns ['status'=>int, 'body'=>string, 'headers'=>array]
     */
    private function simpleRequest(string $method, string $url, array $headers, ?string $body, array &$cookieJar = []): array
    {
        $headerLines = [];
        foreach ($headers as $k => $v) {
            $headerLines[] = $k . ': ' . $v;
        }
        if ($body !== null && !$this->hasContentTypeHeader($headers)) {
            $headerLines[] = 'Content-Type: application/json';
        }
        // Attach cookies from jar if any and no Cookie header already
        if (!$this->hasCookieHeader($headers) && !empty($cookieJar)) {
            $headerLines[] = 'Cookie: ' . $this->cookieString($cookieJar);
        }

        $opts = [
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headerLines),
                'content' => $body ?? '',
                'ignore_errors' => true, // allow body on non-2xx
                'timeout' => 15,
            ],
        ];
        $context = stream_context_create($opts);
        $respBody = @file_get_contents($url, false, $context);
        $respBody = $respBody === false ? '' : $respBody;
        $status = 0;
        $respHeaders = [];
        if (isset($http_response_header) && is_array($http_response_header)) {
            $respHeaders = $http_response_header;
            // First line like: HTTP/1.1 200 OK
            if (preg_match('#HTTP/\S+\s+(\d{3})#', $http_response_header[0], $m)) {
                $status = (int)$m[1];
            }
            // Capture Set-Cookie to update jar
            foreach ($http_response_header as $h) {
                if (stripos($h, 'Set-Cookie:') === 0) {
                    $cookie = trim(substr($h, strlen('Set-Cookie:')));
                    $this->storeCookie($cookieJar, $cookie);
                }
            }
        }
        return ['status' => $status, 'body' => $respBody, 'headers' => $respHeaders];
    }

    private function hasContentTypeHeader(array $headers): bool
    {
        foreach ($headers as $k => $_) {
            if (strtolower((string)$k) === 'content-type') return true;
        }
        return false;
    }

    private function hasCookieHeader(array $headers): bool
    {
        foreach ($headers as $k => $_) {
            if (strtolower((string)$k) === 'cookie') return true;
        }
        return false;
    }

    private function cookieString(array $jar): string
    {
        $pairs = [];
        foreach ($jar as $name => $val) {
            $pairs[] = $name . '=' . $val;
        }
        return implode('; ', $pairs);
    }

    private function storeCookie(array &$jar, string $setCookieLine): void
    {
        // Format: NAME=VALUE; Path=/; HttpOnly; ...
        $parts = explode(';', $setCookieLine);
        if (count($parts) === 0) return;
        $nv = trim($parts[0]);
        $eqPos = strpos($nv, '=');
        if ($eqPos === false) return;
        $name = substr($nv, 0, $eqPos);
        $value = substr($nv, $eqPos + 1);
        if ($name === '') return;
        $jar[$name] = $value;
    }

    /** Replace {{var}} in strings using provided variables */
    private function templateString(string $s, array $vars): string
    {
        return preg_replace_callback('/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/', function($m) use ($vars) {
            $k = $m[1];
            $v = $vars[$k] ?? '';
            if (is_scalar($v)) return (string)$v;
            return json_encode($v);
        }, $s);
    }

    /** Recursively template all string leaves in an array */
    private function templateArray(array $arr, array $vars): array
    {
        $out = [];
        foreach ($arr as $k => $v) {
            if (is_array($v)) $out[$k] = $this->templateArray($v, $vars);
            else if (is_string($v)) $out[$k] = $this->templateString($v, $vars);
            else $out[$k] = $v;
        }
        return $out;
    }

    /** Apply captures to populate variables from response body/headers */
    private function applyCaptures(array $captures, string $body, array $headers, array &$vars): void
    {
        $json = null; $jsonTried = false;
        foreach ($captures as $cap) {
            if (!is_array($cap)) continue;
            $name = (string)($cap['var'] ?? $cap['as'] ?? '');
            if ($name === '') continue;
            // JSON path capture
            if (isset($cap['json'])) {
                if (!$jsonTried) { $json = json_decode($body, true); $jsonTried = true; }
                if (is_array($json)) {
                    $path = (string)$cap['json'];
                    $vars[$name] = $this->dotGet($json, $path);
                    continue;
                }
            }
            // Regex capture from body
            if (isset($cap['regex'])) {
                $pattern = (string)$cap['regex'];
                if (@preg_match($pattern, '') === false) continue; // invalid pattern
                if (preg_match($pattern, $body, $m)) {
                    $group = isset($cap['group']) ? (int)$cap['group'] : 1;
                    $vars[$name] = $m[$group] ?? null;
                    continue;
                }
            }
            // Header capture
            if (isset($cap['header'])) {
                $hname = strtolower((string)$cap['header']);
                $val = null;
                foreach ($headers as $hline) {
                    $pos = strpos($hline, ':'); if ($pos === false) continue;
                    $hn = strtolower(substr($hline, 0, $pos));
                    if ($hn === $hname) { $val = trim(substr($hline, $pos+1)); break; }
                }
                $vars[$name] = $val;
            }
        }
    }

    /** Evaluate a simple arithmetic expression with variables (supports + - * / and parentheses). */
    private function evalArithmetic(string $expr, array $vars)
    {
        // Replace variable names with numeric values
        $replaced = preg_replace_callback('/\b([A-Za-z_][A-Za-z0-9_]*)\b/', function($m) use ($vars) {
            $k = $m[1];
            $v = $vars[$k] ?? 0;
            if (is_numeric($v)) return (string)(0 + $v);
            // If it's a string numeric
            if (is_string($v) && is_numeric($v)) return (string)(0 + $v);
            return '0';
        }, $expr);
        // Allow only numbers, operators, dots, spaces and parentheses
        if (preg_match('/[^0-9+\-*/().\s]/', $replaced)) return null;
        try {
            // Suppress errors; if invalid, return null
            // Note: used only for simple arithmetic from trusted UI
            $val = @eval('return ('.$replaced.');');
            return $val;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function toAbsoluteUrl(string $url): string
    {
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) return $url;
        $base = rtrim($this->baseUrl, '/');
        return $base . $url;
    }

    /**
     * Very small dot-notation getter. Example: path "a.b.0.c"
     */
    private function dotGet(array $data, string $path)
    {
        if ($path === '' || $path === null) return $data;
        $parts = explode('.', $path);
        $cur = $data;
        foreach ($parts as $p) {
            if ($p === '') continue;
            if (is_array($cur) && array_key_exists($p, $cur)) { $cur = $cur[$p]; continue; }
            if (is_array($cur) && ctype_digit($p) && isset($cur[(int)$p])) { $cur = $cur[(int)$p]; continue; }
            return null;
        }
        return $cur;
    }
}
