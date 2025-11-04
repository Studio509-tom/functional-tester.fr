<?php
/**
 * TestExecution
 *
 * Single run of a scenario with timestamps, status and result payload
 * (as JSON string). Stores a screenshot path for post-mortem analysis.
 */
namespace App\Entity;

use App\Repository\TestExecutionRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TestExecutionRepository::class)]
class TestExecution
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    /** Parent scenario; CASCADE delete removes executions on scenario removal */
    #[ORM\ManyToOne(targetEntity: TestScenario::class, inversedBy: 'executions')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?TestScenario $scenario = null;

    #[ORM\Column(length: 32)]
    /** queued|running|success|failed */
    private string $status = 'queued'; // queued|running|success|failed

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $startedAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $finishedAt = null;

    #[ORM\Column(type: 'text', nullable: true)]
    /** Raw result JSON returned by the worker (success, per-step, errors) */
    private ?string $resultJson = null;

    #[ORM\Column(length: 1024, nullable: true)]
    /** Absolute or worker-relative URL for the execution screenshot */
    private ?string $screenshotPath = null;

    public function getId(): ?int { return $this->id; }
    public function getScenario(): ?TestScenario { return $this->scenario; }
    public function setScenario(?TestScenario $scenario): self { $this->scenario = $scenario; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function getStartedAt(): ?\DateTimeImmutable { return $this->startedAt; }
    public function setStartedAt(?\DateTimeImmutable $d): self { $this->startedAt = $d; return $this; }
    public function getFinishedAt(): ?\DateTimeImmutable { return $this->finishedAt; }
    public function setFinishedAt(?\DateTimeImmutable $d): self { $this->finishedAt = $d; return $this; }
    public function getResultJson(): ?string { return $this->resultJson; }
    public function setResultJson(?string $r): self { $this->resultJson = $r; return $this; }
    public function getScreenshotPath(): ?string { return $this->screenshotPath; }
    public function setScreenshotPath(?string $p): self { $this->screenshotPath = $p; return $this; }
}
