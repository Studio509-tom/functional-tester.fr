<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Minimal OpenAI Chat Completions client using PHP streams (no external deps).
 *
 * Responsibilities:
 * - Provide two high-level helpers that transform prompts into strictly-JSON outputs
 *   suitable for our app (scenario steps and HTTP tests).
 * - Handle retries/backoff for 429/5xx and keep responses small (max_tokens).
 * - Cache successful generations for a few hours to minimize API calls and rate limits.
 */
class ChatGptClient
{
    private string $apiKey;

    public function __construct(string $apiKey)
    {
        $this->apiKey = trim((string)$apiKey);
    }

    /** Indique si une clé plausible est configurée */
    public function isConfigured(): bool
    {
        return $this->apiKey !== '' && stripos($this->apiKey, 'sk-') !== false;
    }

    /**
     * Generate functional test steps (Puppeteer-like) from a natural language prompt.
     * Returns an array of step objects.
    *
    * @param string $prompt Free-text instruction
    * @return array List of step objects for the visual builder
     */
    public function suggestScenarioSteps(string $prompt): array
    {
        // Try cache first to reduce API usage and rate limits
        if ($cached = $this->readCache('scenario', $prompt)) {
            return $cached;
        }
        $system = 'Tu es un assistant QA qui génère des étapes de tests E2E pour un navigateur. ' .
            'Réponds uniquement en JSON valide: un tableau d\'objets avec des actions parmi ' .
            '["goto","click","fill","hover","select","wait","waitFor","scroll","press","expectText","expectUrl","expectTitle","screenshot","viewport","userAgent"]. ' .
            'Champs possibles: url, selector, value, text, ms|timeout, contains, key, width, height, ua. ' .
            'Exemple de sortie: ' .
            '[{"action":"goto","url":"https://exemple.com"},{"action":"click","selector":"#cta"}]';

        $content = $this->chat($system, $prompt);
        $json = $this->extractJson($content);
        $data = json_decode($json, true);
        if (!is_array($data)) {
            return [];
        }
        // ensure it's a list of objects
        if (array_values($data) !== $data) {
            // not a list
            return [];
        }
        $this->writeCache('scenario', $prompt, $data);
        return $data;
    }

    /**
     * Generate HTTP unit test cases from a natural language prompt.
     * Returns an array of test case objects.
    *
    * @param string $prompt Free-text instruction
    * @return array List of HTTP test case objects for UnitTestRunner
     */
    public function suggestHttpTests(string $prompt): array
    {
        if ($cached = $this->readCache('http', $prompt)) {
            return $cached;
        }
        $system = 'Tu es un assistant QA qui génère des tests HTTP unitaires. ' .
            'Réponds uniquement en JSON valide: un tableau d\'objets avec les champs ' .
            '{ name, method, url, headers?, body?, assert?: { status?, contains?, json?: { path, equals } } }. ' .
            'Exemple: ' .
            '[{"name":"GET / 200","method":"GET","url":"/","assert":{"status":200}}]';

        $content = $this->chat($system, $prompt);
        $json = $this->extractJson($content);
        $data = json_decode($json, true);
        if (!is_array($data)) {
            return [];
        }
        if (array_values($data) !== $data) {
            return [];
        }
        $this->writeCache('http', $prompt, $data);
        return $data;
    }

    /**
     * Low-level chat call with retries and small response footprint.
     *
     * @param string $system System/behavior prompt
     * @param string $user   User prompt
     * @return string        Model response content (may include code fences)
     */
    private function chat(string $system, string $user): string
    {
        if ($this->apiKey === '' || stripos($this->apiKey, 'sk-') === false) {
            throw new \RuntimeException('OPENAI_API_KEY manquant. Configurez-le dans .env.local');
        }

        $payloadBase = [
            'model' => 'gpt-4o-mini',
            'temperature' => 0.2,
            // Limiter la taille de la réponse pour réduire les erreurs de quota
            'max_tokens' => 400,
            'messages' => [
                [ 'role' => 'system', 'content' => $system ],
                [ 'role' => 'user', 'content' => $user ],
            ],
        ];

        $attempts = 3; $backoff = 1; // secondes
        for ($i = 0; $i < $attempts; $i++) {
            $payload = $payloadBase;
            $opts = [
                'http' => [
                    'method' => 'POST',
                    'header' => [
                        'Content-Type: application/json',
                        'Authorization: Bearer ' . $this->apiKey,
                    ],
                    'content' => json_encode($payload, JSON_UNESCAPED_SLASHES),
                    'timeout' => 30,
                    'ignore_errors' => true, // capture body on non-2xx
                ],
                'ssl' => [
                    'verify_peer' => true,
                    'verify_peer_name' => true,
                ],
            ];
            $ctx = stream_context_create($opts);
            $resp = @file_get_contents('https://api.openai.com/v1/chat/completions', false, $ctx);
            $hdrs = isset($http_response_header) ? (array)$http_response_header : [];
            $status = 0; if (!empty($hdrs[0]) && preg_match('#HTTP/\S+\s+(\d{3})#', $hdrs[0], $m)) { $status = (int)$m[1]; }

            if ($resp === false) {
                // Network or HTTP error; inspect status
                if ($status === 429) {
                    $retryAfter = $this->parseRetryAfter($hdrs) ?? $backoff;
                    if ($i < $attempts - 1) { sleep(max(1, (int)$retryAfter)); $backoff *= 2; continue; }
                    throw new \RuntimeException('OpenAI API rate limit (429). Réessayez plus tard.');
                }
                if ($status >= 500 && $status <= 599) {
                    if ($i < $attempts - 1) { sleep($backoff); $backoff *= 2; continue; }
                    throw new \RuntimeException('OpenAI API indisponible (' . $status . ').');
                }
                $err = $hdrs ? implode("\n", $hdrs) : 'Unknown error';
                throw new \RuntimeException('OpenAI API error: ' . $err);
            }

            if ($status === 429) {
                $retryAfter = $this->parseRetryAfter($hdrs) ?? $backoff;
                if ($i < $attempts - 1) { sleep(max(1, (int)$retryAfter)); $backoff *= 2; continue; }
                throw new \RuntimeException('OpenAI API rate limit (429). Réessayez plus tard.');
            }
            if ($status >= 400) {
                // Try to parse error body
                $errBody = json_decode($resp, true);
                $msg = is_array($errBody) && isset($errBody['error']['message']) ? $errBody['error']['message'] : ('HTTP ' . $status);
                throw new \RuntimeException('OpenAI API error: ' . $msg);
            }

            $data = json_decode($resp, true);
            if (!is_array($data) || empty($data['choices'][0]['message']['content'])) {
                // Try again once if malformed
                if ($i < $attempts - 1) { sleep($backoff); $backoff *= 2; continue; }
                throw new \RuntimeException('Réponse OpenAI invalide');
            }
            return (string)$data['choices'][0]['message']['content'];
        }
        throw new \RuntimeException('Échec de l\'appel OpenAI après plusieurs tentatives');
    }

    private function parseRetryAfter(array $headers): ?int
    {
        foreach ($headers as $h) {
            if (stripos($h, 'Retry-After:') === 0) {
                $v = trim(substr($h, strlen('Retry-After:')));
                if (ctype_digit($v)) return (int)$v;
            }
        }
        return null;
    }

    private function cacheDir(): string
    {
        $dir = __DIR__ . '/../../var/ai-cache';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        return $dir;
    }

    /** @return array|null */
    private function readCache(string $type, string $prompt)
    {
        $base = $this->cacheDir() . '/' . $type;
        if (!is_dir($base)) @mkdir($base, 0777, true);
        $file = $base . '/' . sha1($prompt) . '.json';
        if (!is_file($file)) return null;
        // TTL 6h
        if (filemtime($file) && (time() - filemtime($file) > 6*3600)) return null;
        $raw = @file_get_contents($file);
        if ($raw === false) return null;
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    private function writeCache(string $type, string $prompt, array $data): void
    {
        $base = $this->cacheDir() . '/' . $type;
        if (!is_dir($base)) @mkdir($base, 0777, true);
        $file = $base . '/' . sha1($prompt) . '.json';
        @file_put_contents($file, json_encode($data, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
    }

    /**
     * Try to extract the first JSON block from content (supports ```json fenced code),
     * otherwise returns the original content.
     */
    private function extractJson(string $content): string
    {
        // fenced code block
        if (preg_match('/```json\s*([\s\S]*?)\s*```/i', $content, $m)) {
            return trim($m[1]);
        }
        // maybe raw JSON
        $trim = trim($content);
        if ($trim !== '' && ($trim[0] === '[' || $trim[0] === '{')) {
            return $trim;
        }
        // last resort: try to find the first [ ... ]
        if (preg_match('/\[(?:.|\n|\r)*\]/', $content, $m2)) {
            return trim($m2[0]);
        }
        return '[]';
    }
}
