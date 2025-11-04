<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Entity\TestScenario;
use PHPUnit\Framework\TestCase;

final class TestScenarioTest extends TestCase
{
    public function test_viewport_fields_roundtrip(): void
    {
        $s = new TestScenario();
        $this->assertNull($s->getViewportWidth());
        $this->assertNull($s->getViewportHeight());
        $s->setViewportWidth(1920)->setViewportHeight(1080);
        $this->assertSame(1920, $s->getViewportWidth());
        $this->assertSame(1080, $s->getViewportHeight());
    }
}
