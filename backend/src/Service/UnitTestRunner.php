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
                $payload = is_array($body) ? json_encode($body) : (is_string($body) ? $body : null);
                $res = $this->simpleRequest($method, $full, $headers, $payload);
                $status = $res['status'];
                $text = $res['body'];
                // Assertions
                if (isset($assert['status']) && (int)$assert['status'] !== $status) {
                    $ok = false; $err = 'Expected status '.$assert['status'].' got '.$status;
                }
                if ($ok && isset($assert['contains'])) {
                    $needle = (string)$assert['contains'];
                    if (strpos($text, $needle) === false) { $ok = false; $err = 'Body does not contain "'.$needle.'"'; }
                }
                if ($ok && isset($assert['json'])) {
                    $json = json_decode($text, true);
                    if ($json === null) { $ok = false; $err = 'Response is not JSON'; }
                    else {
                        $path = (string)($assert['json']['path'] ?? '');
                        $expected = $assert['json']['equals'] ?? null;
                        $val = $this->dotGet($json, $path);
                        if ($val !== $expected) { $ok = false; $err = 'JSON path '.$path.' does not equal expected'; }
                    }
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
    private function simpleRequest(string $method, string $url, array $headers, ?string $body): array
    {
        $headerLines = [];
        foreach ($headers as $k => $v) {
            $headerLines[] = $k . ': ' . $v;
        }
        if ($body !== null && !$this->hasContentTypeHeader($headers)) {
            $headerLines[] = 'Content-Type: application/json';
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
