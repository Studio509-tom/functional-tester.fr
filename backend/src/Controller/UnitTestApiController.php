<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\UnitTestRunner;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;

/**
 * API endpoint for executing ad-hoc unit HTTP tests directly from the UI builder.
 */
class UnitTestApiController extends AbstractController
{
    /**
     * POST /api/unit-tests/run
     * Body: { tests: [...] }
     * Response: UnitTestRunner aggregate result JSON.
     */
    #[Route(path: '/api/unit-tests/run', name: 'api_unit_tests_run', methods: ['POST'])]
    public function run(Request $request, UnitTestRunner $runner): JsonResponse
    {
        $payload = json_decode($request->getContent() ?: '[]', true) ?: [];
        $tests = $payload['tests'] ?? [];
        if (!is_array($tests)) {
            return $this->json(['error' => 'Invalid tests array'], 400);
        }
        // Basic shape validation (method+url)
        $normalized = [];
        foreach ($tests as $t) {
            if (!is_array($t)) continue;
            $method = strtoupper((string)($t['method'] ?? 'GET'));
            $url = (string)($t['url'] ?? '/');
            if ($url === '') $url = '/';
            $case = $t;
            $case['method'] = $method;
            $case['url'] = $url;
            $normalized[] = $case;
        }
        $result = $runner->run($normalized);
        return $this->json($result);
    }
}
