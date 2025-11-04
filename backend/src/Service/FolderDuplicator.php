<?php
/**
 * FolderDuplicator
 *
 * Deep-duplicates a folder tree and scenarios inside each folder.
 */
namespace App\Service;

use App\Entity\ScenarioFolder;
use App\Entity\TestScenario;
use App\Repository\TestScenarioRepository;
use Doctrine\ORM\EntityManagerInterface;

class FolderDuplicator
{
    /** @param TestScenarioRepository $scenarioRepo used to list scenarios per folder */
    public function __construct(private TestScenarioRepository $scenarioRepo, private ScenarioDuplicator $scenarioDuplicator) {}

    /** Duplicate the whole subtree starting from $folder and return the new root */
    public function duplicate(ScenarioFolder $folder, EntityManagerInterface $em): ScenarioFolder
    {
        $map = [];
        $newRoot = $this->duplicateFolderRecursive($folder, null, $em, $map);
        $em->flush();
        return $newRoot;
    }

    /** Recursive helper: copies folder metadata, scenarios, and children */
    private function duplicateFolderRecursive(ScenarioFolder $source, ?ScenarioFolder $newParent, EntityManagerInterface $em, array &$map): ScenarioFolder
    {
        $new = new ScenarioFolder();
        $new->setName($source->getName() . ' (copie)');
        $new->setParent($newParent);
        $em->persist($new);
        $em->flush();
        $map[$source->getId()] = $new;

        // Duplicate scenarios in this folder
        $scenarios = $this->scenarioRepo->findBy(['folder' => $source]);
        foreach ($scenarios as $sc) {
            $copy = $this->scenarioDuplicator->duplicate($sc, $em);
            $copy->setFolder($new);
        }

        // Duplicate children folders
        foreach ($source->getChildren() as $child) {
            $this->duplicateFolderRecursive($child, $new, $em, $map);
        }

        return $new;
    }
}
