<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\ChatGptClient;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;

class AiController extends AbstractController
{
    private ChatGptClient $client;

    public function __construct(ChatGptClient $client)
    {
        $this->client = $client;
    }

    /**
     * Indique si les fonctions IA sont activées (feature flag + clé).
     */
    #[Route(path: '/api/ai/enabled', name: 'ai_enabled', methods: ['GET'])]
    public function enabled(): JsonResponse
    {
        return $this->json(['enabled' => $this->isAiEnabled()]);
    }

    /**
     * Generate browser scenario steps from a natural language prompt.
     * Body: { prompt: string }
     * Response: { steps: array }
     */
    #[Route(path: '/api/ai/generate-scenario', name: 'ai_generate_scenario', methods: ['POST'])]
    public function generateScenario(Request $request): JsonResponse
    {
        if (!$this->isAiEnabled()) {
            return $this->json(['error' => 'Fonction IA désactivée'], 400);
        }
        $data = json_decode($request->getContent() ?: '[]', true) ?: [];
        $prompt = trim((string)($data['prompt'] ?? ''));
        if ($prompt === '') {
            return $this->json(['error' => 'Missing prompt'], 400);
        }
        try {
            $steps = $this->client->suggestScenarioSteps($prompt);
            return $this->json(['steps' => $steps]);
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            $code = (strpos($msg, '429') !== false) ? 429 : 502;
            return $this->json(['error' => $msg], $code);
        }
    }

    /**
     * Generate HTTP unit test cases from a natural language prompt.
     * Body: { prompt: string }
     * Response: { tests: array }
     */
    #[Route(path: '/api/ai/generate-http-tests', name: 'ai_generate_http_tests', methods: ['POST'])]
    public function generateHttpTests(Request $request): JsonResponse
    {
        if (!$this->isAiEnabled()) {
            return $this->json(['error' => 'Fonction IA désactivée'], 400);
        }
        $data = json_decode($request->getContent() ?: '[]', true) ?: [];
        $prompt = trim((string)($data['prompt'] ?? ''));
        if ($prompt === '') {
            return $this->json(['error' => 'Missing prompt'], 400);
        }
        try {
            $tests = $this->client->suggestHttpTests($prompt);
            return $this->json(['tests' => $tests]);
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            $code = (strpos($msg, '429') !== false) ? 429 : 502;
            return $this->json(['error' => $msg], $code);
        }
    }

    /**
     * Minimal AI connectivity test endpoint.
     * GET /api/ai/quick-test -> { ok: bool, answer?: string, error?: string }
     */
    #[Route(path: '/api/ai/quick-test', name: 'ai_quick_test', methods: ['GET'])]
    public function quickTest(): JsonResponse
    {
        if (!$this->isAiEnabled()) {
            return $this->json(['ok' => false, 'error' => 'Fonction IA désactivée'], 400);
        }
        try {
            $ans = $this->client->quickSimpleAddition();
            return $this->json(['ok' => true, 'answer' => $ans]);
        } catch (\Throwable $e) {
            $msg = $e->getMessage();

            if (strpos($msg, '429') !== false) {
                // Attendre un peu avant de retenter
                sleep(2);
                try {
                    $ans = $this->client->quickSimpleAddition();
                    return $this->json(['ok' => true, 'answer' => $ans]);
                } catch (\Throwable $e2) {
                    return $this->json(['ok' => false, 'error' => 'Rate limit atteint, réessayez plus tard.'], 429);
                }
            }

            return $this->json(['ok' => false, 'error' => $msg], 502);

        }
    }

    private function isAiEnabled(): bool
    {
        $flag = getenv('OPENAI_ENABLED');
        if ($flag === false && array_key_exists('OPENAI_ENABLED', $_ENV)) {
            $flag = $_ENV['OPENAI_ENABLED'];
        }
        $flag = strtolower(trim((string)$flag));
        $enabledFlag = !in_array($flag, ['0','false','no','off',''], true);
        return $enabledFlag && $this->client->isConfigured();
    }
}
