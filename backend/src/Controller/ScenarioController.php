<?php
/**
 * ScenarioController
 *
 * CRUD for TestScenario entities, execution trigger, builder preview /api, and
 * a proxy endpoint for screenshots.
 */
namespace App\Controller;

use App\Entity\TestExecution;
use App\Entity\TestScenario;
use App\Form\TestScenarioType;
use App\Repository\TestExecutionRepository;
use App\Repository\TestScenarioRepository;
use App\Service\WorkerClient;
use App\Service\ScenarioDuplicator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/scenario')]
class ScenarioController extends AbstractController
{
    #[Route('/', name: 'scenario_index', methods: ['GET'])]
    /** List all scenarios */
    public function index(TestScenarioRepository $repo): Response {
        return $this->render('scenario/index.html.twig', ['scenarios' => $repo->findAll()]);
    }

    #[Route('/new', name: 'scenario_new', methods: ['GET','POST'])]
    /** Create a new scenario */
    public function new(Request $req, EntityManagerInterface $em): Response {
        $scenario = new TestScenario();
        $form = $this->createForm(TestScenarioType::class, $scenario);
        $form->handleRequest($req);
        if ($form->isSubmitted() && $form->isValid()) {
            $em->persist($scenario);
            $em->flush();
            return $this->redirectToRoute('scenario_show', ['id' => $scenario->getId()]);
        }
        return $this->render('scenario/new.html.twig', ['form' => $form->createView()]);
    }

    #[Route('/{id}', name: 'scenario_show', methods: ['GET'])]
    /** Show a scenario details and recent executions */
    public function show(TestScenario $scenario, TestExecutionRepository $execs, \App\Service\WorkerClient $worker): Response {
        $executions = $execs->findBy(['scenario' => $scenario], ['id' => 'DESC'], 10);
        return $this->render('scenario/show.html.twig', [
            'scenario' => $scenario,
            'executions' => $executions,
            'workerBase' => $worker->getBaseUrl(),
        ]);
    }

    #[Route('/{id}/edit', name: 'scenario_edit', methods: ['GET','POST'])]
    /** Edit an existing scenario */
    public function edit(TestScenario $scenario, Request $req, EntityManagerInterface $em): Response {
        $form = $this->createForm(TestScenarioType::class, $scenario);
        $form->handleRequest($req);
        if ($form->isSubmitted() && $form->isValid()) {
            $em->flush();
            return $this->redirectToRoute('scenario_show', ['id' => $scenario->getId()]);
        }
        return $this->render('scenario/edit.html.twig', ['form' => $form->createView(), 'scenario' => $scenario]);
    }

    #[Route('/{id}/duplicate', name: 'scenario_duplicate', methods: ['POST'])]
    /** Duplicate a scenario (no executions copied) */
    public function duplicate(TestScenario $scenario, ScenarioDuplicator $duplicator, EntityManagerInterface $em, Request $req): Response
    {
        if (!$this->isCsrfTokenValid('dup_'.$scenario->getId(), $req->request->get('_token'))) {
            return $this->redirectToRoute('scenario_show', ['id' => $scenario->getId()]);
        }
        $copy = $duplicator->duplicate($scenario, $em);
        return $this->redirectToRoute('scenario_edit', ['id' => $copy->getId()]);
    }

    #[Route('/{id}/delete', name: 'scenario_delete', methods: ['POST'])]
    /** Delete a scenario and cascade delete its executions */
    public function delete(TestScenario $scenario, EntityManagerInterface $em, Request $req): Response {
        if ($this->isCsrfTokenValid('del_'.$scenario->getId(), $req->request->get('_token'))) {
            $em->remove($scenario);
            $em->flush();
        }
        return $this->redirectToRoute('scenario_index');
    }

    #[Route('/{id}/run', name: 'scenario_run', methods: ['POST'], requirements: ['id' => '\\d+'])]
    /** Create an execution, call the worker, persist result and redirect back to show */
    public function run(TestScenario $scenario, EntityManagerInterface $em, WorkerClient $worker): Response {
        $exec = new TestExecution();
        $exec->setScenario($scenario);
        $exec->setStatus('running');
        $exec->setStartedAt(new \DateTimeImmutable());
        $em->persist($exec);
        $em->flush();

        $steps = json_decode($scenario->getStepsJson(), true) ?: [];
        try {
            // Default reliability/reporting options (can be surfaced to UI later)
            $options = [
                'perStepScreenshot' => true,
                'retries' => 1,
                'backoffMs' => 500,
                'stepTimeoutMs' => 10000,
                'video' => false,
                // Default to a desktop-like viewport unless overridden by a 'viewport' step
                'viewport' => ['width' => 1920, 'height' => 1080],
                // Match exact viewport captures by default (1920x1080), can be set true for full-page
                'screenshotFullPage' => false,
                // Default to a crisp PNG (retina-like) with deviceScaleFactor=2
                'deviceScaleFactor' => 2,
            ];
            // If scenario has preferred viewport, override defaults
            if ($scenario->getViewportWidth() && $scenario->getViewportHeight()) {
                $options['viewport'] = [
                    'width' => max(320, (int)$scenario->getViewportWidth()),
                    'height' => max(320, (int)$scenario->getViewportHeight()),
                ];
            }
            // Override from per-scenario preferences if provided
            $options['perStepScreenshot'] = $scenario->isPerStepScreenshot();
            $options['screenshotFullPage'] = $scenario->isScreenshotFullPage();
            $options['retries'] = max(0, (int)$scenario->getRetries());
            $options['backoffMs'] = max(0, (int)$scenario->getBackoffMs());
            $options['stepTimeoutMs'] = max(1000, (int)$scenario->getStepTimeoutMs());
            $options['deviceScaleFactor'] = max(1, min(3, (int)$scenario->getDeviceScaleFactor()));
            if ($scenario->getUserAgent()) { $options['userAgent'] = $scenario->getUserAgent(); }

            $result = $worker->run($steps, $options);
            $exec->setStatus(!empty($result['success']) ? 'success' : 'failed');
            $exec->setResultJson(json_encode($result));
            if (!empty($result['screenshotPath'])) {
                $path = $result['screenshotPath'];
                if (is_string($path) && str_starts_with($path, '/')) {
                    $exec->setScreenshotPath($worker->getBaseUrl() . $path);
                } else {
                    $exec->setScreenshotPath($path);
                }
            }
        } catch (\Throwable $e) {
            $exec->setStatus('failed');
            $exec->setResultJson(json_encode(['success' => false, 'errors' => [$e->getMessage()]]));
        } finally {
            $exec->setFinishedAt(new \DateTimeImmutable());
            $em->flush();
        }

        return $this->redirectToRoute('scenario_show', ['id' => $scenario->getId()]);
    }

    #[Route('/builder/run', name: 'api_run', methods: ['POST'], priority: 10)]
    /** Builder preview endpoint; runs provided steps without persistence */
    public function apiRun(Request $request, WorkerClient $worker): JsonResponse
    {
        $data = json_decode($request->getContent() ?? '[]', true) ?: [];
        $steps = $data['steps'] ?? [];
        if (!is_array($steps)) {
            return new JsonResponse(['success' => false, 'errors' => ['Invalid steps payload']], 400);
        }
        try {
            // Apply sane defaults for preview as well
            $options = [
                'perStepScreenshot' => true,
                'retries' => 0,
                'backoffMs' => 300,
                'stepTimeoutMs' => 10000,
                'video' => false,
                'viewport' => ['width' => 1920, 'height' => 1080],
                'screenshotFullPage' => false,
                'deviceScaleFactor' => 2,
            ];
            $result = $worker->run($steps, $options);
            return new JsonResponse($result);
        } catch (\Throwable $e) {
            return new JsonResponse([
                'success' => false,
                'errors' => [$e->getMessage()],
            ], 500);
        }
    }

    #[Route('/execution/{id}/screenshot', name: 'execution_screenshot', methods: ['GET'])]
    /** Proxy a worker-hosted screenshot through Symfony for consistent domain */
    public function screenshot(TestExecution $execution, WorkerClient $worker): Response
    {
        $path = $execution->getScreenshotPath();
        if (!$path) {
            throw $this->createNotFoundException('No screenshot for this execution');
        }
        try {
            $data = $worker->fetch($path);
            return new Response($data['body'], 200, ['Content-Type' => $data['contentType']]);
        } catch (\Throwable $e) {
            throw $this->createNotFoundException('Screenshot not available');
        }
    }

    #[Route('/execution/{id}', name: 'execution_show', methods: ['GET'])]
    /** Show a detailed execution report (timeline, steps, errors, durations) */
    public function executionShow(TestExecution $execution, WorkerClient $worker): Response
    {
        $result = [];
        if ($execution->getResultJson()) {
            try { $result = json_decode($execution->getResultJson(), true) ?: []; } catch (\Throwable $e) { $result = []; }
        }
        return $this->render('execution/show.html.twig', [
            'execution' => $execution,
            'result' => $result,
            'workerBase' => $worker->getBaseUrl(),
        ]);
    }

    #[Route('/execution/{id}/step-screenshot', name: 'execution_step_screenshot', methods: ['GET'])]
    /** Proxy per-step screenshots recorded in resultJson (restricted to /output/*) */
    public function stepScreenshot(TestExecution $execution, Request $request, WorkerClient $worker): Response
    {
        $path = (string)($request->query->get('path') ?? '');
        if (!$path || !str_starts_with($path, '/output/')) {
            throw $this->createNotFoundException('Invalid step screenshot path');
        }
        try {
            $data = $worker->fetch($path);
            return new Response($data['body'], 200, ['Content-Type' => $data['contentType']]);
        } catch (\Throwable $e) {
            throw $this->createNotFoundException('Step screenshot not available');
        }
    }
}
