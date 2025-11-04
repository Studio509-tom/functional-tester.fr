#!/usr/bin/env node
// Scaffold script for Functional Tester (SaaS)
// Creates/installs Symfony backend, Node worker, and base files.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const backendDir = path.join(root, 'backend');
const workerDir = path.join(root, 'worker');

function sh(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFileEnsured(filePath, content) {
  ensureDir(path.dirname(filePath));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
    console.log(`Created ${path.relative(root, filePath)}`);
  } else {
    console.log(`Exists  ${path.relative(root, filePath)} (skipped)`);
  }
}

function isDirEmpty(dir) {
  if (!fs.existsSync(dir)) return true;
  const entries = fs.readdirSync(dir).filter((n) => !n.startsWith('.'));
  return entries.length === 0;
}

function createBackend() {
  ensureDir(backendDir);
  const hasComposer = fs.existsSync(path.join(backendDir, 'composer.json'));
  if (!hasComposer) {
    if (isDirEmpty(backendDir)) {
      console.log('Creating Symfony skeleton...');
      try {
        sh('composer create-project symfony/skeleton backend');
      } catch (e) {
        console.warn('Composer create-project failed (network/SSL?). You can run composer inside DDEV later. Continuing scaffold...');
      }
    } else {
      console.log('Backend directory is not empty. Initializing composer.json and requiring packages in-place...');
      // Minimal composer.json
      writeFileEnsured(
        path.join(backendDir, 'composer.json'),
        JSON.stringify(
          {
            name: 'functional-tester/backend',
            type: 'project',
            license: 'proprietary',
            require: { php: '>=8.2', 'ext-ctype': '*', 'ext-iconv': '*' },
            autoload: { 'psr-4': { 'App\\\\': 'src/' } }
          },
          null,
          2
        )
      );
    }
  }

  // Ensure required bundles/libs are present
  console.log('Installing Symfony bundles and libs...');
  try {
    sh(
      'composer require symfony/framework-bundle symfony/twig-bundle symfony/security-bundle symfony/orm-pack doctrine/doctrine-migrations-bundle guzzlehttp/guzzle symfony/dotenv symfony/console -d backend'
    );
  } catch (e) {
    console.warn('Composer require failed (network/SSL?). You can run "ddev composer install" after starting DDEV. Continuing scaffold...');
  }

  writeFileEnsured(
    path.join(backendDir, '.env'),
    'APP_ENV=dev\nAPP_SECRET=change_me\nWORKER_URL="http://127.0.0.1:4000"\nDATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/functional_tester?serverVersion=8.0&charset=utf8mb4"\n'
  );

  writeFileEnsured(
    path.join(backendDir, 'config', 'packages', 'framework.yaml'),
    'framework:\n    secret: "%env(APP_SECRET)%"\n    http_method_override: true\n    session:\n        handler_id: null\n        cookie_secure: auto\n    php_errors:\n        log: true\n'
  );
  writeFileEnsured(
    path.join(backendDir, 'config', 'packages', 'twig.yaml'),
    'twig:\n    default_path: "%kernel.project_dir%/templates"\n'
  );
  writeFileEnsured(
    path.join(backendDir, 'config', 'packages', 'doctrine.yaml'),
    'doctrine:\n    dbal:\n        url: "%env(resolve:DATABASE_URL)%"\n        driver: "pdo_mysql"\n        server_version: "8.0"\n        charset: utf8mb4\n    orm:\n        auto_generate_proxy_classes: true\n        naming_strategy: doctrine.orm.naming_strategy.underscore_number_aware\n        auto_mapping: true\n        mappings:\n            App:\n                is_bundle: false\n                type: attribute\n                dir: "%kernel.project_dir%/src/Entity"\n                prefix: App\\Entity\n                alias: App\n'
  );
  writeFileEnsured(
    path.join(backendDir, 'config', 'packages', 'security.yaml'),
    'security:\n    password_hashers:\n        Symfony\\Component\\Security\\Core\\User\\PasswordAuthenticatedUserInterface: "auto"\n    providers:\n        app_user_provider:\n            entity:\n                class: App\\Entity\\User\n                property: email\n    firewalls:\n        dev:\n            pattern: ^/(_(profiler|wdt)|css|images|js)/\n            security: false\n        main:\n            lazy: true\n            provider: app_user_provider\n            form_login: ~\n            logout: ~\n    access_control: []\n'
  );
  writeFileEnsured(
    path.join(backendDir, 'config', 'routes.yaml'),
    'controllers:\n    resource: ../src/Controller/\n    type: attribute\n'
  );
  writeFileEnsured(
    path.join(backendDir, 'config', 'services.yaml'),
    `services:\n  _defaults:\n    autowire: true\n    autoconfigure: true\n\n  App\\:\n    resource: ../src/*\n    exclude: ../src/{DependencyInjection,Entity,Kernel.php}\n\n  App\\Controller\\:\n    resource: ../src/Controller/\n    tags: ['controller.service_arguments']\n\n  App\\Service\\WorkerClient:\n    arguments:\n      $workerBaseUrl: '%env(WORKER_URL)%'\n`
  );

  writeFileEnsured(
    path.join(backendDir, 'src', 'Kernel.php'),
    `<?php\nnamespace App;\n\nuse Symfony\\Bundle\\FrameworkBundle\\Kernel\\MicroKernelTrait;\nuse Symfony\\Component\\HttpKernel\\Kernel as BaseKernel;\n\nclass Kernel extends BaseKernel\n{\n    use MicroKernelTrait;\n}\n`
  );
  writeFileEnsured(
    path.join(backendDir, 'public', 'index.php'),
    `<?php\nuse App\\Kernel;\nuse Symfony\\Component\\Dotenv\\Dotenv;\nuse Symfony\\Component\\ErrorHandler\\Debug;\nuse Symfony\\Component\\HttpFoundation\\Request;\n\nrequire dirname(__DIR__).'/vendor/autoload.php';\n\nif (!isset($_SERVER['APP_ENV'])) {\n    (new Dotenv())->bootEnv(dirname(__DIR__).'/.env');\n}\n\nif ($_SERVER['APP_DEBUG']) {\n    umask(0000);\n    Debug::enable();\n}\n\n$kernel = new Kernel($_SERVER['APP_ENV'], (bool) $_SERVER['APP_DEBUG']);\n$request = Request::createFromGlobals();\n$response = $kernel->handle($request);\n$response->send();\n$kernel->terminate($request, $response);\n`
  );

  writeFileEnsured(
    path.join(backendDir, 'src', 'Entity', 'User.php'),
    `<?php\nnamespace App\\Entity;\n\nuse App\\Repository\\UserRepository;\nuse Doctrine\\ORM\\Mapping as ORM;\nuse Symfony\\Component\\Security\\Core\\User\\PasswordAuthenticatedUserInterface;\nuse Symfony\\Component\\Security\\Core\\User\\UserInterface;\n\n#[ORM\\Entity(repositoryClass: UserRepository::class)]\nclass User implements UserInterface, PasswordAuthenticatedUserInterface\n{\n    #[ORM\\Id]\n    #[ORM\\GeneratedValue]\n    #[ORM\\Column]\n    private ?int $id = null;\n\n    #[ORM\\Column(length: 180, unique: true)]\n    private string $email = '';\n\n    #[ORM\\Column(type: 'json')]\n    private array $roles = [];\n\n    #[ORM\\Column]\n    private string $password = '';\n\n    public function getId(): ?int { return $this->id; }\n    public function getUserIdentifier(): string { return $this->email; }\n    public function getEmail(): string { return $this->email; }\n    public function setEmail(string $email): self { $this->email = $email; return $this; }\n    public function getRoles(): array { return array_unique(array_merge($this->roles, ['ROLE_USER'])); }\n    public function setRoles(array $roles): self { $this->roles = $roles; return $this; }\n    public function getPassword(): string { return $this->password; }\n    public function setPassword(string $password): self { $this->password = $password; return $this; }\n    public function eraseCredentials(): void {}\n}\n`
  );
  writeFileEnsured(
    path.join(backendDir, 'src', 'Entity', 'TestScenario.php'),
    `<?php\nnamespace App\\Entity;\n\nuse App\\Repository\\TestScenarioRepository;\nuse Doctrine\\ORM\\Mapping as ORM;\n\n#[ORM\\Entity(repositoryClass: TestScenarioRepository::class)]\nclass TestScenario\n{\n    #[ORM\\Id]\n    #[ORM\\GeneratedValue]\n    #[ORM\\Column]\n    private ?int $id = null;\n\n    #[ORM\\Column(length: 255)]\n    private string $name = '';\n\n    #[ORM\\Column(type: 'text')]\n    private string $stepsJson = '[]';\n\n    #[ORM\\ManyToOne(targetEntity: User::class)]\n    private ?User $owner = null;\n\n    #[ORM\\Column(type: 'datetime_immutable')]\n    private \\DateTimeImmutable $createdAt;\n\n    public function __construct() { $this->createdAt = new \\DateTimeImmutable(); }\n\n    public function getId(): ?int { return $this->id; }\n    public function getName(): string { return $this->name; }\n    public function setName(string $name): self { $this->name = $name; return $this; }\n    public function getStepsJson(): string { return $this->stepsJson; }\n    public function setStepsJson(string $stepsJson): self { $this->stepsJson = $stepsJson; return $this; }\n    public function getOwner(): ?User { return $this->owner; }\n    public function setOwner(?User $owner): self { $this->owner = $owner; return $this; }\n    public function getCreatedAt(): \\DateTimeImmutable { return $this->createdAt; }\n}\n`
  );
  writeFileEnsured(
    path.join(backendDir, 'src', 'Entity', 'TestExecution.php'),
    `<?php\nnamespace App\\Entity;\n\nuse App\\Repository\\TestExecutionRepository;\nuse Doctrine\\ORM\\Mapping as ORM;\n\n#[ORM\\Entity(repositoryClass: TestExecutionRepository::class)]\nclass TestExecution\n{\n    #[ORM\\Id]\n    #[ORM\\GeneratedValue]\n    #[ORM\\Column]\n    private ?int $id = null;\n\n    #[ORM\\ManyToOne(targetEntity: TestScenario::class)]\n    private ?TestScenario $scenario = null;\n\n    #[ORM\\Column(length: 32)]\n    private string $status = 'queued'; // queued|running|success|failed\n\n    #[ORM\\Column(type: 'datetime_immutable', nullable: true)]\n    private ?\\DateTimeImmutable $startedAt = null;\n\n    #[ORM\\Column(type: 'datetime_immutable', nullable: true)]\n    private ?\\DateTimeImmutable $finishedAt = null;\n\n    #[ORM\\Column(type: 'text', nullable: true)]\n    private ?string $resultJson = null;\n\n    #[ORM\\Column(length: 1024, nullable: true)]\n    private ?string $screenshotPath = null;\n\n    public function getId(): ?int { return $this->id; }\n    public function getScenario(): ?TestScenario { return $this->scenario; }\n    public function setScenario(?TestScenario $scenario): self { $this->scenario = $scenario; return $this; }\n    public function getStatus(): string { return $this->status; }\n    public function setStatus(string $status): self { $this->status = $status; return $this; }\n    public function getStartedAt(): ?\\DateTimeImmutable { return $this->startedAt; }\n    public function setStartedAt(?\\DateTimeImmutable $d): self { $this->startedAt = $d; return $this; }\n    public function getFinishedAt(): ?\\DateTimeImmutable { return $this->finishedAt; }\n    public function setFinishedAt(?\\DateTimeImmutable $d): self { $this->finishedAt = $d; return $this; }\n    public function getResultJson(): ?string { return $this->resultJson; }\n    public function setResultJson(?string $r): self { $this->resultJson = $r; return $this; }\n    public function getScreenshotPath(): ?string { return $this->screenshotPath; }\n    public function setScreenshotPath(?string $p): self { $this->screenshotPath = $p; return $this; }\n}\n`
  );

  writeFileEnsured(
    path.join(backendDir, 'src', 'Repository', 'UserRepository.php'),
    `<?php\nnamespace App\\Repository;\n\nuse App\\Entity\\User;\nuse Doctrine\\Bundle\\DoctrineBundle\\Repository\\ServiceEntityRepository;\nuse Doctrine\\Persistence\\ManagerRegistry;\n\nclass UserRepository extends ServiceEntityRepository\n{\n    public function __construct(ManagerRegistry $registry) { parent::__construct($registry, User::class); }\n}\n`
  );
  writeFileEnsured(
    path.join(backendDir, 'src', 'Repository', 'TestScenarioRepository.php'),
    `<?php\nnamespace App\\Repository;\n\nuse App\\Entity\\TestScenario;\nuse Doctrine\\Bundle\\DoctrineBundle\\Repository\\ServiceEntityRepository;\nuse Doctrine\\Persistence\\ManagerRegistry;\n\nclass TestScenarioRepository extends ServiceEntityRepository\n{\n    public function __construct(ManagerRegistry $registry) { parent::__construct($registry, TestScenario::class); }\n}\n`
  );
  writeFileEnsured(
    path.join(backendDir, 'src', 'Repository', 'TestExecutionRepository.php'),
    `<?php\nnamespace App\\Repository;\n\nuse App\\Entity\\TestExecution;\nuse Doctrine\\Bundle\\DoctrineBundle\\Repository\\ServiceEntityRepository;\nuse Doctrine\\Persistence\\ManagerRegistry;\n\nclass TestExecutionRepository extends ServiceEntityRepository\n{\n    public function __construct(ManagerRegistry $registry) { parent::__construct($registry, TestExecution::class); }\n}\n`
  );

  writeFileEnsured(
    path.join(backendDir, 'src', 'Service', 'WorkerClient.php'),
    `<?php\nnamespace App\\Service;\n\nuse GuzzleHttp\\Client;\n\nclass WorkerClient\n{\n    private string $base;\n    private Client $http;\n    public function __construct(string $workerBaseUrl) {\n        $this->base = rtrim($workerBaseUrl, '/');\n        $this->http = new Client(['base_uri' => $this->base, 'timeout' => 120]);\n    }\n\n    /** @return array [success:bool, steps:array, errors:array, screenshotPath:string|null] */\n    public function run(array $steps): array {\n        $resp = $this->http->post('/run', [\n            'json' => ['steps' => $steps],\n        ]);\n        return json_decode((string)$resp->getBody(), true);\n    }\n}\n`
  );

  writeFileEnsured(
    path.join(backendDir, 'src', 'Form', 'TestScenarioType.php'),
    `<?php\nnamespace App\\Form;\n\nuse App\\Entity\\TestScenario;\nuse Symfony\\Component\\Form\\AbstractType;\nuse Symfony\\Component\\Form\\Extension\\Core\\Type\\TextareaType;\nuse Symfony\\Component\\Form\\Extension\\Core\\Type\\TextType;\nuse Symfony\\Component\\Form\\FormBuilderInterface;\nuse Symfony\\Component\\OptionsResolver\\OptionsResolver;\n\nclass TestScenarioType extends AbstractType\n{\n    public function buildForm(FormBuilderInterface $builder, array $options): void\n    {\n        $builder\n            ->add('name', TextType::class)\n            ->add('stepsJson', TextareaType::class, [\n                'attr' => ['rows' => 12, 'class' => 'font-monospace'],\n            ]);\n    }\n\n    public function configureOptions(OptionsResolver $resolver): void\n    {\n        $resolver->setDefaults(['data_class' => TestScenario::class]);\n    }\n}\n`
  );

  writeFileEnsured(
    path.join(backendDir, 'src', 'Controller', 'DashboardController.php'),
    `<?php\nnamespace App\\Controller;\n\nuse App\\Repository\\TestExecutionRepository;\nuse App\\Repository\\TestScenarioRepository;\nuse Symfony\\Bundle\\FrameworkBundle\\Controller\\AbstractController;\nuse Symfony\\Component\\HttpFoundation\\Response;\nuse Symfony\\Component\\Routing\\Annotation\\Route;\n\nclass DashboardController extends AbstractController\n{\n    #[Route('/', name: 'dashboard', methods: ['GET'])]\n    public function index(TestScenarioRepository $scenarios, TestExecutionRepository $execs): Response {\n        $recentExecutions = $execs->findBy([], ['id' => 'DESC'], 10);\n        return $this->render('dashboard/index.html.twig', [\n            'scenarios' => $scenarios->findBy([], ['id' => 'DESC']),\n            'executions' => $recentExecutions,\n        ]);\n    }\n}\n`
  );
  writeFileEnsured(
    path.join(backendDir, 'src', 'Controller', 'ScenarioController.php'),
    `<?php\nnamespace App\\Controller;\n\nuse App\\Entity\\TestExecution;\nuse App\\Entity\\TestScenario;\nuse App\\Form\\TestScenarioType;\nuse App\\Repository\\TestExecutionRepository;\nuse App\\Repository\\TestScenarioRepository;\nuse App\\Service\\WorkerClient;\nuse Doctrine\\ORM\\EntityManagerInterface;\nuse Symfony\\Bundle\\FrameworkBundle\\Controller\\AbstractController;\nuse Symfony\\Component\\HttpFoundation\\Request;\nuse Symfony\\Component\\HttpFoundation\\Response;\nuse Symfony\\Component\\Routing\\Annotation\\Route;\n\n#[Route('/scenario')]\nclass ScenarioController extends AbstractController\n{\n    #[Route('/', name: 'scenario_index', methods: ['GET'])]\n    public function index(TestScenarioRepository $repo): Response {\n        return $this->render('scenario/index.html.twig', ['scenarios' => $repo->findAll()]);\n    }\n\n    #[Route('/new', name: 'scenario_new', methods: ['GET','POST'])]\n    public function new(Request $req, EntityManagerInterface $em): Response {\n        $scenario = new TestScenario();\n        $form = $this->createForm(TestScenarioType::class, $scenario);\n        $form->handleRequest($req);\n        if ($form->isSubmitted() && $form->isValid()) {\n            $em->persist($scenario);\n            $em->flush();\n            return $this->redirectToRoute('scenario_show', ['id' => $scenario->getId()]);\n        }\n        return $this->render('scenario/new.html.twig', ['form' => $form->createView()]);\n    }\n\n    #[Route('/{id}', name: 'scenario_show', methods: ['GET'])]\n    public function show(TestScenario $scenario, TestExecutionRepository $execs): Response {\n        $executions = $execs->findBy(['scenario' => $scenario], ['id' => 'DESC'], 10);\n        return $this->render('scenario/show.html.twig', ['scenario' => $scenario, 'executions' => $executions]);\n    }\n\n    #[Route('/{id}/edit', name: 'scenario_edit', methods: ['GET','POST'])]\n    public function edit(TestScenario $scenario, Request $req, EntityManagerInterface $em): Response {\n        $form = $this->createForm(TestScenarioType::class, $scenario);\n        $form->handleRequest($req);\n        if ($form->isSubmitted() && $form->isValid()) {\n            $em->flush();\n            return $this->redirectToRoute('scenario_show', ['id' => $scenario->getId()]);\n        }\n        return $this->render('scenario/edit.html.twig', ['form' => $form->createView(), 'scenario' => $scenario]);\n    }\n\n    #[Route('/{id}/delete', name: 'scenario_delete', methods: ['POST'])]\n    public function delete(TestScenario $scenario, EntityManagerInterface $em, Request $req): Response {\n        if ($this->isCsrfTokenValid('del_'.$scenario->getId(), $req->request->get('_token'))) {\n            $em->remove($scenario);\n            $em->flush();\n        }\n        return $this->redirectToRoute('scenario_index');\n    }\n\n    #[Route('/{id}/run', name: 'scenario_run', methods: ['POST'])]\n    public function run(TestScenario $scenario, EntityManagerInterface $em, WorkerClient $worker): Response {\n        $exec = new TestExecution();\n        $exec->setScenario($scenario);\n        $exec->setStatus('running');\n        $exec->setStartedAt(new \\DateTimeImmutable());\n        $em->persist($exec);\n        $em->flush();\n\n        $steps = json_decode($scenario->getStepsJson(), true) ?: [];\n        try {\n            $result = $worker->run($steps);\n            $exec->setStatus(!empty($result['success']) ? 'success' : 'failed');\n            $exec->setResultJson(json_encode($result));\n            if (!empty($result['screenshotPath'])) { $exec->setScreenshotPath($result['screenshotPath']); }\n        } catch (\\Throwable $e) {\n            $exec->setStatus('failed');\n            $exec->setResultJson(json_encode(['success' => false, 'errors' => [$e->getMessage()]]));\n        } finally {\n            $exec->setFinishedAt(new \\DateTimeImmutable());\n            $em->flush();\n        }\n\n        return $this->redirectToRoute('scenario_show', ['id' => $scenario->getId()]);\n    }\n}\n`
  );

  writeFileEnsured(
    path.join(backendDir, 'templates', 'base.html.twig'),
    `<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>{% block title %}Functional Tester{% endblock %}</title>\n  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">\n  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>\n</head>\n<body class="bg-light">\n<nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">\n  <div class="container-fluid">\n    <a class="navbar-brand" href="{{ path('dashboard') }}">Functional Tester</a>\n  </div>\n</nav>\n<main class="container">\n  {% block body %}{% endblock %}\n</main>\n<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>\n<script src="/js/app.js"></script>\n</body>\n</html>`
  );
  writeFileEnsured(
    path.join(backendDir, 'templates', 'dashboard', 'index.html.twig'),
    `{% extends 'base.html.twig' %}\n{% block title %}Dashboard - Functional Tester{% endblock %}\n{% block body %}\n<div class="d-flex justify-content-between align-items-center mb-3">\n  <h1>Dashboard</h1>\n  <a href="{{ path('scenario_new') }}" class="btn btn-primary">Nouveau scénario</a>\n</div>\n<div class="row">\n  <div class="col-md-6">\n    <h4>Scénarios</h4>\n    <ul class="list-group">\n      {% for s in scenarios %}\n        <li class="list-group-item d-flex justify-content-between align-items-center">\n          <span>{{ s.name }}</span>\n          <a class="btn btn-sm btn-outline-secondary" href="{{ path('scenario_show', {id: s.id}) }}">Ouvrir</a>\n        </li>\n      {% else %}\n        <li class="list-group-item">Aucun scénario</li>\n      {% endfor %}\n    </ul>\n  </div>\n  <div class="col-md-6">\n    <h4>Exécutions récentes</h4>\n    <ul class="list-group">\n      {% for e in executions %}\n        <li class="list-group-item">#{{ e.id }} - {{ e.scenario.name }} - <span class="badge text-bg-{{ e.status == 'success' ? 'success' : (e.status == 'failed' ? 'danger' : 'secondary') }}">{{ e.status }}</span></li>\n      {% else %}\n        <li class="list-group-item">Aucune exécution</li>\n      {% endfor %}\n    </ul>\n  </div>\n</div>\n{% endblock %}`
  );
  writeFileEnsured(
    path.join(backendDir, 'templates', 'scenario', 'index.html.twig'),
    `{% extends 'base.html.twig' %}\n{% block title %}Scénarios{% endblock %}\n{% block body %}\n<div class="d-flex justify-content-between align-items-center mb-3">\n  <h1>Scénarios</h1>\n  <a href="{{ path('scenario_new') }}" class="btn btn-primary">Nouveau scénario</a>\n</div>\n<table class="table table-striped">\n  <thead><tr><th>ID</th><th>Nom</th><th>Actions</th></tr></thead>\n  <tbody>\n  {% for s in scenarios %}\n    <tr><td>{{ s.id }}</td><td>{{ s.name }}</td><td><a class="btn btn-sm btn-secondary" href="{{ path('scenario_show', {id: s.id}) }}">Ouvrir</a></td></tr>\n  {% else %}\n    <tr><td colspan="3">Aucun scénario</td></tr>\n  {% endfor %}\n  </tbody>\n</table>\n{% endblock %}`
  );
  writeFileEnsured(
    path.join(backendDir, 'templates', 'scenario', 'new.html.twig'),
    `{% extends 'base.html.twig' %}\n{% block title %}Nouveau scénario{% endblock %}\n{% block body %}\n<h1>Nouveau scénario</h1>\n{{ form_start(form) }}\n  {{ form_row(form.name) }}\n  <div class="mb-3">\n    <label class="form-label">Étapes (JSON)</label>\n    {{ form_widget(form.stepsJson) }}\n    <div class="form-text">Ex: [{"action":"goto","url":"https://example.org"}]</div>\n  </div>\n  <button class="btn btn-primary">Enregistrer</button>\n{{ form_end(form) }}\n{% endblock %}`
  );
  writeFileEnsured(
    path.join(backendDir, 'templates', 'scenario', 'edit.html.twig'),
    `{% extends 'base.html.twig' %}\n{% block title %}Éditer scénario{% endblock %}\n{% block body %}\n<h1>Éditer scénario</h1>\n{{ form_start(form) }}\n  {{ form_row(form.name) }}\n  <div class="mb-3">\n    <label class="form-label">Étapes (JSON)</label>\n    {{ form_widget(form.stepsJson) }}\n  </div>\n  <button class="btn btn-primary">Mettre à jour</button>\n{{ form_end(form) }}\n{% endblock %}`
  );
  writeFileEnsured(
    path.join(backendDir, 'templates', 'scenario', 'show.html.twig'),
    `{% extends 'base.html.twig' %}\n{% block title %}Scénario {{ scenario.name }}{% endblock %}\n{% block body %}\n<div class="d-flex justify-content-between align-items-center mb-3">\n  <h1>{{ scenario.name }}</h1>\n  <div>\n    <a class="btn btn-outline-secondary" href="{{ path('scenario_edit', {id: scenario.id}) }}">Éditer</a>\n    <form method="post" action="{{ path('scenario_delete', {id: scenario.id}) }}" class="d-inline" onsubmit="return confirm('Supprimer ?');">\n      <input type="hidden" name="_token" value="{{ csrf_token('del_' ~ scenario.id) }}"/>\n      <button class="btn btn-outline-danger">Supprimer</button>\n    </form>\n  </div>\n</div>\n<pre class="bg-white p-3 border">{{ scenario.stepsJson }}</pre>\n<form method="post" action="{{ path('scenario_run', {id: scenario.id}) }}">\n  <button class="btn btn-success mt-2" id="btn-run">Lancer le test</button>\n</form>\n<hr/>\n<h3>Dernières exécutions</h3>\n<ul class="list-group">\n  {% for e in executions %}\n    <li class="list-group-item">\n      #{{ e.id }} - Statut: <span class="badge text-bg-{{ e.status == 'success' ? 'success' : (e.status == 'failed' ? 'danger' : 'secondary') }}">{{ e.status }}</span>\n      {% if e.screenshotPath %} - <a href="{{ e.screenshotPath }}" target="_blank">Capture</a>{% endif %}\n      {% if e.resultJson %}<details class="mt-2"><summary>Détails</summary><pre>{{ e.resultJson }}</pre></details>{% endif %}\n    </li>\n  {% else %}\n    <li class="list-group-item">Aucune exécution</li>\n  {% endfor %}\n</ul>\n{% endblock %}`
  );

  writeFileEnsured(
    path.join(backendDir, 'public', 'js', 'app.js'),
    `// Placeholder for potential AJAX enhancements.\n// Current implementation uses classic POST and redirect for running tests.\nconsole.log('Functional Tester app.js loaded');\n`
  );
}

function createWorker() {
  ensureDir(workerDir);
  writeFileEnsured(
    path.join(workerDir, 'package.json'),
    JSON.stringify({
      name: 'functional-tester-worker',
      version: '1.0.0',
      type: 'module',
      scripts: { start: 'node ./src/index.js' },
      dependencies: {
        express: '^4.19.2',
        puppeteer: '^22.13.1',
        'body-parser': '^1.20.2'
      }
    }, null, 2)
  );
  writeFileEnsured(
    path.join(workerDir, 'src', 'index.js'),
    `import express from 'express';\nimport bodyParser from 'body-parser';\nimport { runScenario } from './runner.js';\nimport path from 'path';\nimport { fileURLToPath } from 'url';\n\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = path.dirname(__filename);\n\nconst app = express();\napp.use(bodyParser.json({ limit: '2mb' }));\n\nconst PORT = process.env.PORT || 4000;\nconst OUT_DIR = path.join(__dirname, '..', 'output');\napp.use('/output', express.static(OUT_DIR));\n\napp.post('/run', async (req, res) => {\n  const steps = req.body?.steps || [];\n  try {\n    const result = await runScenario(steps, OUT_DIR);\n    res.json(result);\n  } catch (e) {\n    res.status(500).json({ success: false, errors: [String(e)] });\n  }\n});\n\napp.listen(PORT, () => console.log('Worker listening on http://127.0.0.1:' + PORT));\n`
  );
  writeFileEnsured(
    path.join(workerDir, 'src', 'runner.js'),
    `import fs from 'fs';\nimport path from 'path';\nimport puppeteer from 'puppeteer';\n\nexport async function runScenario(steps, outDir) {\n  const browser = await puppeteer.launch({ headless: 'new' });\n  const page = await browser.newPage();\n  const actions = [];\n  const errors = [];\n  let screenshotPath = null;\n\n  try {\n    for (const [i, step] of steps.entries()) {\n      const a = step.action;\n      if (!a) { errors.push('Step '+i+': missing action'); continue; }\n      try {\n        if (a === 'goto') {\n          await page.goto(step.url, { waitUntil: 'networkidle2', timeout: 60000 });\n        } else if (a === 'fill') {\n          await page.waitForSelector(step.selector, { timeout: 20000 });\n          await page.focus(step.selector);\n          await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.value = ''; }, step.selector);\n          await page.type(step.selector, step.value ?? '', { delay: 20 });\n        } else if (a === 'click') {\n          await page.waitForSelector(step.selector, { timeout: 20000 });\n          await page.click(step.selector);\n          await page.waitForNetworkIdle({ timeout: 30000 }).catch(()=>{});\n        } else if (a === 'expectText') {\n          await page.waitForSelector(step.selector, { timeout: 20000 });\n          const text = await page.$eval(step.selector, el => el.innerText || el.textContent || '');\n          if (!String(text).includes(String(step.text ?? ''))) throw new Error('Text not found: '+step.text);\n        } else {\n          throw new Error('Unknown action: '+a);\n        }\n        actions.push({ index: i, action: a, ok: true });\n      } catch (e) {\n        errors.push('Step '+i+' ('+a+'): '+String(e));\n        actions.push({ index: i, action: a, ok: false, error: String(e) });\n        break;\n      }\n    }\n  } finally {\n    try {\n      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });\n      const file = 'screenshot-'+Date.now()+'.png';\n      const full = path.join(outDir, file);\n      await page.screenshot({ path: full, fullPage: true }).catch(()=>{});\n      screenshotPath = '/output/'+file;\n    } catch {}\n    await browser.close();\n  }\n  return { success: errors.length === 0, steps: actions, errors, screenshotPath };\n}\n`
  );
  writeFileEnsured(path.join(workerDir, 'output', '.gitkeep'), '');
}

function main() {
  console.log('Scaffolding Functional Tester...');
  createBackend();
  createWorker();
  console.log('Done. Next steps:');
  console.log('- Configure backend/.env (DATABASE_URL, WORKER_URL)');
  console.log('- Run: cd backend; composer install');
  console.log('- Run: cd worker; npm install; npm start');
}

main();