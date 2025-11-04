<?php
/**
 * DashboardController
 *
 * Provides the main landing page with a quick overview of scenarios and recent
 * executions. Also exposes a lightweight /api/run endpoint used by the Step
 * Builder preview to run ad-hoc steps without persisting a scenario.
 */
namespace App\Controller;

use App\Repository\TestExecutionRepository;
use App\Repository\TestScenarioRepository;
use App\Service\WorkerClient;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class DashboardController extends AbstractController
{
    #[Route('/', name: 'dashboard', methods: ['GET'])]
    /**
     * Render the dashboard with latest scenarios and executions
     */
    public function index(TestScenarioRepository $scenarios, TestExecutionRepository $execs): Response {
        $recentExecutions = $execs->findBy([], ['id' => 'DESC'], 10);
        return $this->render('dashboard/index.html.twig', [
            'scenarios' => $scenarios->findBy([], ['id' => 'DESC']),
            'executions' => $recentExecutions,
        ]);
    }

    #[Route('/api/run', name: 'api_run', methods: ['POST'])]
    /**
     * Run ad-hoc steps against the worker and return the raw result.
     *
     * Request body: { "steps": Step[] }
     * Response body: { success: bool, steps: StepResult[], errors: string[], screenshotPath?: string }
     */
    public function apiRun(Request $request, WorkerClient $worker): JsonResponse
    {
        $data = json_decode($request->getContent() ?? '[]', true) ?: [];
        $steps = $data['steps'] ?? [];
        if (!is_array($steps)) {
            return new JsonResponse(['success' => false, 'errors' => ['Invalid steps payload']], 400);
        }
        try {
            $result = $worker->run($steps);
            return new JsonResponse($result);
        } catch (\Throwable $e) {
            return new JsonResponse([
                'success' => false,
                'errors' => [$e->getMessage()],
            ], 500);
        }
    }
}
