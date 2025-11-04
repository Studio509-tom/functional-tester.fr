<?php
/**
 * ScenarioDuplicator
 *
 * Service to clone a TestScenario without copying executions.
 */
namespace App\Service;

use App\Entity\TestScenario;
use Doctrine\ORM\EntityManagerInterface;

class ScenarioDuplicator
{
    /**
     * Create a persisted copy of a scenario with a "(copie)" suffix.
     */
    public function duplicate(TestScenario $original, EntityManagerInterface $em): TestScenario
    {
        $copy = new TestScenario();
        $name = trim($original->getName());
        if ($name === '') { $name = 'Scénario'; }
        $copy->setName($name . ' (copie)');
        $copy->setStepsJson($original->getStepsJson());
        $copy->setOwner($original->getOwner());
        $copy->setFolder($original->getFolder());

        $em->persist($copy);
        $em->flush();
        return $copy;
    }
}
