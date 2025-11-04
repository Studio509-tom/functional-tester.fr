<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\TestScenario;
use App\Service\ScenarioDuplicator;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;

final class ScenarioDuplicatorTest extends TestCase
{
    public function test_duplicate_copies_basic_fields_and_appends_suffix(): void
    {
        $original = (new TestScenario())
            ->setName('Parcours A')
            ->setStepsJson('[{"action":"goto","url":"https://example.org"}]');

        $em = $this->createMock(EntityManagerInterface::class);
        $em->expects($this->once())->method('persist')->with($this->isInstanceOf(TestScenario::class));
        $em->expects($this->once())->method('flush');

        $dupe = (new ScenarioDuplicator())->duplicate($original, $em);

        $this->assertNotSame($original, $dupe);
        $this->assertSame('Parcours A (copie)', $dupe->getName());
        $this->assertSame($original->getStepsJson(), $dupe->getStepsJson());
    }
}
