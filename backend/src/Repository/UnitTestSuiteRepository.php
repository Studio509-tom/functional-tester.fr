<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\UnitTestSuite;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class UnitTestSuiteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, UnitTestSuite::class);
    }
}
