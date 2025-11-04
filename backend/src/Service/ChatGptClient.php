<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Minimal OpenAI Chat Completions client using PHP streams (no external deps).
 */
class ChatGptClient
{
    private string $apiKey;

    public function __construct(string $apiKey)
    {
        $this->apiKey = trim((string)$apiKey);
    }

    /**
     * Generate functional test steps (Puppeteer-like) from a natural language prompt.
     * Returns an array of step objects.
     */
    public function suggestScenarioSteps(string $prompt): array
    {
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
        return $data;
    }

    /**
     * Generate HTTP unit test cases from a natural language prompt.
     * Returns an array of test case objects.
     */
    public function suggestHttpTests(string $prompt): array
    {
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
        return $data;
    }

    private function chat(string $system, string $user): string
    {
        if ($this->apiKey === '' || stripos($this->apiKey, 'sk-') === false) {
            throw new \RuntimeException('OPENAI_API_KEY manquant. Configurez-le dans .env.local');
        }

        $payload = [
            'model' => 'gpt-4o-mini',
            'temperature' => 0.2,
            'messages' => [
                [ 'role' => 'system', 'content' => $system ],
                [ 'role' => 'user', 'content' => $user ],
            ],
        ];

        $opts = [
            'http' => [
                'method' => 'POST',
                'header' => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $this->apiKey,
                ],
                'content' => json_encode($payload, JSON_UNESCAPED_SLASHES),
                'timeout' => 30,
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ];
        $ctx = stream_context_create($opts);
        $resp = @file_get_contents('https://api.openai.com/v1/chat/completions', false, $ctx);
        if ($resp === false) {
            $err = isset($http_response_header) ? implode("\n", (array)$http_response_header) : 'Unknown error';
            throw new \RuntimeException('OpenAI API error: ' . $err);
        }
        $data = json_decode($resp, true);
        if (!is_array($data) || empty($data['choices'][0]['message']['content'])) {
            throw new \RuntimeException('Réponse OpenAI invalide');
        }
        return (string)$data['choices'][0]['message']['content'];
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
