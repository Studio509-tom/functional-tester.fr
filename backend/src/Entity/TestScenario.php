<?php
/**
 * TestScenario
 *
 * Represents a user-defined browser scenario. Steps are stored as JSON to
 * keep the model flexible and are interpreted by the Node/Puppeteer worker.
 */
namespace App\Entity;

use App\Repository\TestScenarioRepository;
use Doctrine\ORM\Mapping as ORM;
use App\Entity\ScenarioFolder;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;

#[ORM\Entity(repositoryClass: TestScenarioRepository::class)]
class TestScenario
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    /** Human-readable scenario name */
    #[ORM\Column(length: 255)]
    private string $name = '';

    /** JSON array of step objects understood by the worker */
    #[ORM\Column(type: 'text')]
    private string $stepsJson = '[]';

    /** Optional owner; authentication/authorization can attach here later */
    #[ORM\ManyToOne(targetEntity: User::class)]
    private ?User $owner = null;

    /** Creation timestamp */
    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    /** Optional folder (project) organization */
    #[ORM\ManyToOne(targetEntity: ScenarioFolder::class)]
    private ?ScenarioFolder $folder = null;

    /** Executions history; cascade+orphanRemoval ensures FKs are cleaned */
    #[ORM\OneToMany(mappedBy: 'scenario', targetEntity: TestExecution::class, cascade: ['remove'], orphanRemoval: true)]
    private Collection $executions;

    /** Optional preferred viewport width for this scenario (e.g., 1920) */
    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $viewportWidth = null;

    /** Optional preferred viewport height for this scenario (e.g., 1080) */
    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $viewportHeight = null;

    /** Take a per-step screenshot after each successful step */
    #[ORM\Column(type: 'boolean', options: ['default' => true])]
    private bool $perStepScreenshot = true;

    /** Use full page screenshots instead of viewport-bounded */
    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $screenshotFullPage = false;

    /** Number of retries per step on failure */
    #[ORM\Column(type: 'integer', options: ['default' => 1])]
    private int $retries = 1;

    /** Backoff base in ms between retries */
    #[ORM\Column(type: 'integer', options: ['default' => 500])]
    private int $backoffMs = 500;

    /** Default step timeout in ms */
    #[ORM\Column(type: 'integer', options: ['default' => 10000])]
    private int $stepTimeoutMs = 10000;

    /** Device scale factor for screenshots (1,2,3) */
    #[ORM\Column(type: 'integer', options: ['default' => 2])]
    private int $deviceScaleFactor = 2;

    /** Optional default User-Agent to use */
    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    private ?string $userAgent = null;

    public function __construct() { $this->createdAt = new \DateTimeImmutable(); $this->executions = new ArrayCollection(); }

    public function getId(): ?int { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getStepsJson(): string { return $this->stepsJson; }
    public function setStepsJson(string $stepsJson): self { $this->stepsJson = $stepsJson; return $this; }
    public function getOwner(): ?User { return $this->owner; }
    public function setOwner(?User $owner): self { $this->owner = $owner; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getFolder(): ?ScenarioFolder { return $this->folder; }
    public function setFolder(?ScenarioFolder $folder): self { $this->folder = $folder; return $this; }

    /** @return Collection<int, TestExecution> */
    public function getExecutions(): Collection { return $this->executions; }

    public function getViewportWidth(): ?int { return $this->viewportWidth; }
    public function setViewportWidth(?int $w): self { $this->viewportWidth = $w; return $this; }
    public function getViewportHeight(): ?int { return $this->viewportHeight; }
    public function setViewportHeight(?int $h): self { $this->viewportHeight = $h; return $this; }

    public function isPerStepScreenshot(): bool { return $this->perStepScreenshot; }
    public function setPerStepScreenshot(bool $v): self { $this->perStepScreenshot = $v; return $this; }
    public function isScreenshotFullPage(): bool { return $this->screenshotFullPage; }
    public function setScreenshotFullPage(bool $v): self { $this->screenshotFullPage = $v; return $this; }
    public function getRetries(): int { return $this->retries; }
    public function setRetries(int $v): self { $this->retries = max(0, $v); return $this; }
    public function getBackoffMs(): int { return $this->backoffMs; }
    public function setBackoffMs(int $v): self { $this->backoffMs = max(0, $v); return $this; }
    public function getStepTimeoutMs(): int { return $this->stepTimeoutMs; }
    public function setStepTimeoutMs(int $v): self { $this->stepTimeoutMs = max(0, $v); return $this; }
    public function getDeviceScaleFactor(): int { return $this->deviceScaleFactor; }
    public function setDeviceScaleFactor(int $v): self { $this->deviceScaleFactor = max(1, min(3, $v)); return $this; }
    public function getUserAgent(): ?string { return $this->userAgent; }
    public function setUserAgent(?string $ua): self { $this->userAgent = $ua ? trim($ua) : null; return $this; }
}
