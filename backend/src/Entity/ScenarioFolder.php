<?php
/**
 * ScenarioFolder
 *
 * Simple hierarchical folder structure to organize scenarios.
 */
namespace App\Entity;

use App\Repository\ScenarioFolderRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ScenarioFolderRepository::class)]
class ScenarioFolder
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    /** Folder display name */
    #[ORM\Column(length: 255)]
    private string $name = '';

    /** Optional parent folder (self-referential relation) */
    #[ORM\ManyToOne(targetEntity: self::class, inversedBy: 'children')]
    private ?self $parent = null;

    /** Child folders */
    #[ORM\OneToMany(mappedBy: 'parent', targetEntity: self::class)]
    private Collection $children;

    public function __construct()
    {
        $this->children = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): self { $this->name = $name; return $this; }

    public function getParent(): ?self { return $this->parent; }
    public function setParent(?self $parent): self { $this->parent = $parent; return $this; }

    /** @return Collection<int,self> */
    public function getChildren(): Collection { return $this->children; }

    /**
     * Ensure the existence of functional and unit test subfolders.
     *
     * @return ScenarioFolder[] Returns an array with the created or existing subfolders.
     */
    public function ensureTestSubfolders(): array
    {
        $subfolderNames = ['Tests fonctionnel', 'Tests unitaire'];
        $existingSubfolders = $this->getChildren()->filter(function (self $child) use ($subfolderNames) {
            return in_array($child->getName(), $subfolderNames, true);
        });

        $createdSubfolders = [];
        foreach ($subfolderNames as $name) {
            $subfolder = $existingSubfolders->filter(function (self $child) use ($name) {
                return $child->getName() === $name;
            })->first();

            if (!$subfolder) {
                $subfolder = new self();
                $subfolder->setName($name);
                $subfolder->setParent($this);
                $this->getChildren()->add($subfolder);
                $createdSubfolders[] = $subfolder;
            }
        }

        return $createdSubfolders;
    }

    /**
     * Add a child folder to this folder.
     */
    public function addChild(self $child): self
    {
        if (!$this->children->contains($child)) {
            $this->children->add($child);
            $child->setParent($this);
        }
        return $this;
    }
}
