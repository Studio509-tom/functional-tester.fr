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

    #[Route(path: '/api/ai/generate-scenario', name: 'ai_generate_scenario', methods: ['POST'])]
    public function generateScenario(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent() ?: '[]', true) ?: [];
        $prompt = trim((string)($data['prompt'] ?? ''));
        if ($prompt === '') {
            return $this->json(['error' => 'Missing prompt'], 400);
        }
        try {
            $steps = $this->client->suggestScenarioSteps($prompt);
            return $this->json(['steps' => $steps]);
        } catch (\Throwable $e) {
            return $this->json(['error' => $e->getMessage()], 502);
        }
    }

    #[Route(path: '/api/ai/generate-http-tests', name: 'ai_generate_http_tests', methods: ['POST'])]
    public function generateHttpTests(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent() ?: '[]', true) ?: [];
        $prompt = trim((string)($data['prompt'] ?? ''));
        if ($prompt === '') {
            return $this->json(['error' => 'Missing prompt'], 400);
        }
        try {
            $tests = $this->client->suggestHttpTests($prompt);
            return $this->json(['tests' => $tests]);
        } catch (\Throwable $e) {
            return $this->json(['error' => $e->getMessage()], 502);
        }
    }
}
