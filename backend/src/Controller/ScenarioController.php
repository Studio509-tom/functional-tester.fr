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
        // Expand relative URLs if baseUrl is defined
        if ($scenario->getBaseUrl()) {
            $base = $scenario->getBaseUrl();
            $steps = array_map(function($s) use ($base) {
                if (is_array($s) && ($s['action'] ?? null) === 'goto' && isset($s['url']) && is_string($s['url']) && str_starts_with($s['url'], '/')) {
                    $s['url'] = rtrim($base, '/') . $s['url'];
                }
                return $s;
            }, $steps);
        }
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
        $baseUrl = isset($data['baseUrl']) && is_string($data['baseUrl']) ? trim($data['baseUrl']) : null;
        if ($baseUrl) {
            if ($baseUrl !== '' && str_ends_with($baseUrl, '/')) { $baseUrl = rtrim($baseUrl, '/'); }
            if ($baseUrl && !preg_match('/^https?:\/\//i', $baseUrl) && preg_match('/^[\w.-]+\.[A-Za-z]{2,}/', $baseUrl)) {
                $baseUrl = 'https://' . $baseUrl; // auto-normalise
            }
            $steps = array_map(function($s) use ($baseUrl) {
                if (is_array($s) && ($s['action'] ?? null) === 'goto' && isset($s['url']) && is_string($s['url']) && str_starts_with($s['url'], '/')) {
                    $s['url'] = rtrim($baseUrl, '/') . $s['url'];
                }
                return $s;
            }, $steps);
        }
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

    #[Route('/builder/validate', name: 'api_validate', methods: ['POST'], priority: 9)]
    /** Validate a steps payload and return structured errors/warnings */
    public function apiValidate(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent() ?? '[]', true) ?: [];
        $steps = $data['steps'] ?? [];
        if (!is_array($steps)) {
            return new JsonResponse(['success' => false, 'errors' => ['Invalid steps payload']], 400);
        }
        $errors = [];
        $warnings = [];
        foreach ($steps as $i => $s) {
            $action = is_array($s) && isset($s['action']) ? (string)$s['action'] : null;
            if (!$action) { $errors[] = "Step {$i}: missing action"; continue; }
            switch ($action) {
                case 'goto':
                    if (empty($s['url']) || !is_string($s['url'])) $errors[] = "Step {$i} (goto): missing or invalid url";
                    break;
                case 'fill':
                    if (empty($s['selector'])) $errors[] = "Step {$i} (fill): missing selector";
                    break;
                case 'click': case 'hover': case 'scroll':
                    if (empty($s['selector'])) $errors[] = "Step {$i} ({$action}): missing selector";
                    break;
                case 'select':
                    if (empty($s['selector'])) $errors[] = "Step {$i} (select): missing selector";
                    if (!array_key_exists('value', $s)) $warnings[] = "Step {$i} (select): no value provided";
                    break;
                case 'wait':
                    if (!isset($s['ms']) && !isset($s['timeout'])) $errors[] = "Step {$i} (wait): missing ms/timeout";
                    break;
                case 'waitFor':
                    if (empty($s['selector'])) $errors[] = "Step {$i} (waitFor): missing selector";
                    break;
                case 'press':
                    if (empty($s['key'])) $errors[] = "Step {$i} (press): missing key";
                    break;
                case 'expectText':
                    if (empty($s['selector'])) $errors[] = "Step {$i} (expectText): missing selector";
                    if (!array_key_exists('text', $s) && !array_key_exists('contains', $s)) $warnings[] = "Step {$i} (expectText): no text provided";
                    break;
                case 'expectUrl':
                    if (empty($s['contains']) && empty($s['urlContains'])) $errors[] = "Step {$i} (expectUrl): missing contains fragment";
                    break;
                case 'expectTitle':
                    if (empty($s['text']) && empty($s['contains'])) $errors[] = "Step {$i} (expectTitle): missing text fragment";
                    break;
                case 'expectVisible': case 'expectHidden':
                    if (empty($s['selector'])) $errors[] = "Step {$i} ({$action}): missing selector";
                    break;
                case 'expectAttribute':
                    if (empty($s['selector'])) { $errors[] = "Step {$i} (expectAttribute): missing selector"; }
                    if (empty($s['attribute'])) { $errors[] = "Step {$i} (expectAttribute): missing attribute name"; }
                    break;
                case 'expectCount':
                    if (empty($s['selector'])) { $errors[] = "Step {$i} (expectCount): missing selector"; }
                    if (!isset($s['count'])) { $errors[] = "Step {$i} (expectCount): missing count"; }
                    break;
                case 'screenshot': case 'viewport': case 'userAgent': case 'raw':
                    // no required fields for basic cases
                    break;
                default:
                    $warnings[] = "Step {$i}: unknown action '{$action}'";
            }
        }
        return new JsonResponse(['success' => count($errors) === 0, 'errors' => $errors, 'warnings' => $warnings]);
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
