<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\UnitTestSuiteRepository;
use Doctrine\ORM\Mapping as ORM;
use App\Entity\ScenarioFolder;

#[ORM\Entity(repositoryClass: UnitTestSuiteRepository::class)]
class UnitTestSuite
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $name = '';

    #[ORM\Column(type: 'text')]
    private string $testsJson = '[]';

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    /** Optional folder (project) organization, like functional scenarios */
    #[ORM\ManyToOne(targetEntity: ScenarioFolder::class)]
    private ?ScenarioFolder $folder = null;

    public function __construct() { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): ?int { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }
    public function getTestsJson(): string { return $this->testsJson; }
    public function setTestsJson(string $json): self { $this->testsJson = $json; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getFolder(): ?ScenarioFolder { return $this->folder; }
    public function setFolder(?ScenarioFolder $folder): self { $this->folder = $folder; return $this; }
}
